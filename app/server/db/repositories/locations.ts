import { AREA_SEARCH_LIMITS, type AreaType, type AliasLanguage } from "~/lib/constants";
import { detectAliasLanguage, escapeLike, normalizeLocationText, prefixUpperBound } from "~/lib/location";
import { batch, execute, queryAll, queryFirst, type SqlValue } from "../client";

/**
 * Location data access (neighborhood-first).
 *   country → division → district → city → area (neighborhood) → optional sub-area (area with a parent).
 * "Active" always means: the item AND every ancestor above it is active. Inactive places never reach users.
 * All values are bound parameters; the only SQL text built from code is fixed fragments from this file.
 */

// ---------------------------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------------------------

export interface Country {
  id: number;
  name: string;
  slug: string;
  code: string;
}
export interface Division {
  id: number;
  countryId: number;
  name: string;
  slug: string;
}
export interface District {
  id: number;
  divisionId: number;
  name: string;
  slug: string;
}
export interface City {
  id: number;
  name: string;
  nameEn: string | null;
  nameBn: string | null;
  slug: string;
  latitude: number | null;
  longitude: number | null;
}
export interface Area {
  id: number;
  cityId: number;
  name: string;
  nameEn: string | null;
  nameBn: string | null;
  slug: string;
  areaType: AreaType;
  parentAreaId: number | null;
  latitude: number | null;
  longitude: number | null;
  radiusM: number | null;
}

/** What the neighborhood picker receives. `matchedAlias` shows WHY a result matched ("Hatem Khan" → Hetem Khan). */
export interface AreaOption {
  id: number;
  name: string;
  nameBn: string | null;
  slug: string;
  areaType: AreaType;
  parentAreaId: number | null;
  matchedAlias: string | null;
}

export interface AreaAlias {
  id: number;
  areaId: number;
  alias: string;
  normalizedAlias: string;
  language: AliasLanguage;
}

// ---------------------------------------------------------------------------------------------------------------
// SQL fragments (constants only — never include user input)
// ---------------------------------------------------------------------------------------------------------------

/** Joins from alias `c` (cities) up the administrative chain, requiring every ancestor to be active. */
const ACTIVE_CHAIN_JOINS = `
  JOIN districts d  ON d.id  = c.district_id  AND d.is_active  = 1
  JOIN divisions dv ON dv.id = d.division_id  AND dv.is_active = 1
  JOIN countries co ON co.id = dv.country_id  AND co.is_active = 1`;

const CITY_COLUMNS = "c.id, c.name, c.name_en AS nameEn, c.name_bn AS nameBn, c.slug, c.latitude, c.longitude";

const AREA_COLUMNS = `a.id, a.city_id AS cityId, a.name, a.name_en AS nameEn, a.name_bn AS nameBn, a.slug,
  a.area_type AS areaType, a.parent_area_id AS parentAreaId, a.latitude, a.longitude, a.radius_m AS radiusM`;

const AREA_OPTION_COLUMNS = `a.id, a.name, a.name_bn AS nameBn, a.slug, a.area_type AS areaType,
  a.parent_area_id AS parentAreaId`;

// ---------------------------------------------------------------------------------------------------------------
// Administrative hierarchy
// ---------------------------------------------------------------------------------------------------------------

export function listActiveCountries(db: D1Database): Promise<Country[]> {
  return queryAll<Country>(db, "SELECT id, name, slug, code FROM countries WHERE is_active = 1 ORDER BY name");
}

export function listActiveDivisions(db: D1Database, countryId: number): Promise<Division[]> {
  return queryAll<Division>(
    db,
    `SELECT dv.id, dv.country_id AS countryId, dv.name, dv.slug
     FROM divisions dv JOIN countries co ON co.id = dv.country_id AND co.is_active = 1
     WHERE dv.country_id = ? AND dv.is_active = 1 ORDER BY dv.name`,
    [countryId],
  );
}

export function listActiveDistricts(db: D1Database, divisionId: number): Promise<District[]> {
  return queryAll<District>(
    db,
    `SELECT d.id, d.division_id AS divisionId, d.name, d.slug
     FROM districts d
     JOIN divisions dv ON dv.id = d.division_id AND dv.is_active = 1
     JOIN countries co ON co.id = dv.country_id AND co.is_active = 1
     WHERE d.division_id = ? AND d.is_active = 1 ORDER BY d.name`,
    [divisionId],
  );
}

export function listActiveCitiesByDistrict(db: D1Database, districtId: number): Promise<City[]> {
  return queryAll<City>(
    db,
    `SELECT ${CITY_COLUMNS} FROM cities c ${ACTIVE_CHAIN_JOINS}
     WHERE c.district_id = ? AND c.is_active = 1 ORDER BY c.name`,
    [districtId],
  );
}

/** Every active city (the user-facing city selector). */
export function listActiveCities(db: D1Database): Promise<City[]> {
  return queryAll<City>(db, `SELECT ${CITY_COLUMNS} FROM cities c ${ACTIVE_CHAIN_JOINS} WHERE c.is_active = 1 ORDER BY c.name`);
}

export function getCityBySlug(db: D1Database, slug: string): Promise<City | null> {
  return queryFirst<City>(
    db,
    `SELECT ${CITY_COLUMNS} FROM cities c ${ACTIVE_CHAIN_JOINS} WHERE c.slug = ? AND c.is_active = 1`,
    [slug],
  );
}

export async function isActiveCity(db: D1Database, cityId: number): Promise<boolean> {
  const row = await queryFirst<{ ok: number }>(
    db,
    `SELECT 1 AS ok FROM cities c ${ACTIVE_CHAIN_JOINS} WHERE c.id = ? AND c.is_active = 1`,
    [cityId],
  );
  return row !== null;
}

// ---------------------------------------------------------------------------------------------------------------
// Areas (neighborhoods and sub-areas)
// ---------------------------------------------------------------------------------------------------------------

/** Active TOP-LEVEL neighborhoods of a city (sub-areas are listed through listActiveSubAreas). Ordered by importance. */
export function listActiveAreas(db: D1Database, cityId: number, limit: number = 500): Promise<Area[]> {
  return queryAll<Area>(
    db,
    `SELECT ${AREA_COLUMNS} FROM areas a JOIN cities c ON c.id = a.city_id ${ACTIVE_CHAIN_JOINS}
     WHERE a.city_id = ? AND a.is_active = 1 AND c.is_active = 1 AND a.parent_area_id IS NULL
     ORDER BY a.search_priority DESC, a.name LIMIT ?`,
    [cityId, limit],
  );
}

export function listActiveSubAreas(db: D1Database, parentAreaId: number): Promise<AreaOption[]> {
  return queryAll<AreaOption>(
    db,
    `SELECT ${AREA_OPTION_COLUMNS}, NULL AS matchedAlias
     FROM areas a JOIN cities c ON c.id = a.city_id ${ACTIVE_CHAIN_JOINS}
     JOIN areas p ON p.id = a.parent_area_id AND p.is_active = 1
     WHERE a.parent_area_id = ? AND a.is_active = 1 AND c.is_active = 1 ORDER BY a.search_priority DESC, a.name`,
    [parentAreaId],
  );
}

export function getAreaBySlug(db: D1Database, cityId: number, slug: string): Promise<Area | null> {
  return queryFirst<Area>(
    db,
    `SELECT ${AREA_COLUMNS} FROM areas a JOIN cities c ON c.id = a.city_id ${ACTIVE_CHAIN_JOINS}
     WHERE a.city_id = ? AND a.slug = ? AND a.is_active = 1 AND c.is_active = 1`,
    [cityId, slug],
  );
}

export function getActiveAreaById(db: D1Database, areaId: number): Promise<Area | null> {
  return queryFirst<Area>(
    db,
    `SELECT ${AREA_COLUMNS} FROM areas a JOIN cities c ON c.id = a.city_id ${ACTIVE_CHAIN_JOINS}
     WHERE a.id = ? AND a.is_active = 1 AND c.is_active = 1`,
    [areaId],
  );
}

/** Relationship check: is `areaId` an ACTIVE top-level neighborhood of the ACTIVE city `cityId`? */
export async function isActiveAreaInCity(db: D1Database, cityId: number, areaId: number): Promise<boolean> {
  const row = await queryFirst<{ ok: number }>(
    db,
    `SELECT 1 AS ok FROM areas a JOIN cities c ON c.id = a.city_id ${ACTIVE_CHAIN_JOINS}
     WHERE a.id = ? AND a.city_id = ? AND a.parent_area_id IS NULL AND a.is_active = 1 AND c.is_active = 1`,
    [areaId, cityId],
  );
  return row !== null;
}

/** Relationship check: is `subAreaId` an ACTIVE sub-area whose parent is the (active) neighborhood `areaId`? */
export async function isActiveSubAreaOf(db: D1Database, areaId: number, subAreaId: number): Promise<boolean> {
  const row = await queryFirst<{ ok: number }>(
    db,
    `SELECT 1 AS ok FROM areas s
     JOIN areas p ON p.id = s.parent_area_id AND p.is_active = 1
     JOIN cities c ON c.id = s.city_id ${ACTIVE_CHAIN_JOINS}
     WHERE s.id = ? AND s.parent_area_id = ? AND s.is_active = 1 AND c.is_active = 1`,
    [subAreaId, areaId],
  );
  return row !== null;
}

// ---------------------------------------------------------------------------------------------------------------
// Alias resolution and neighborhood search
// ---------------------------------------------------------------------------------------------------------------

/**
 * Exact alias resolution: "Hatem Khan", "হেতেম খান", "hetem  khan" … → the ONE canonical area (or null).
 * Unambiguous because (city_id, normalized_alias) is unique.
 */
export function resolveAreaByText(db: D1Database, cityId: number, text: string): Promise<AreaOption | null> {
  const key = normalizeLocationText(text);
  if (key === "") return Promise.resolve(null);
  return queryFirst<AreaOption>(
    db,
    `SELECT ${AREA_OPTION_COLUMNS}, al.alias AS matchedAlias
     FROM area_aliases al
     JOIN areas a ON a.id = al.area_id AND a.is_active = 1
     JOIN cities c ON c.id = a.city_id ${ACTIVE_CHAIN_JOINS}
     WHERE al.city_id = ? AND al.normalized_alias = ? AND c.is_active = 1`,
    [cityId, key],
  );
}

/**
 * Server-side neighborhood autocomplete for one city. Ranking: exact alias → alias starts with the text → alias contains it.
 * Never fuzzy: only controlled normalization plus the alias table decide what matches.
 * Without a query it returns the city's most important neighborhoods (so the picker is useful before typing).
 */
export async function searchAreas(
  db: D1Database,
  cityId: number,
  query: string | undefined,
  options: { limit?: number } = {},
): Promise<AreaOption[]> {
  const limit = Math.min(Math.max(options.limit ?? AREA_SEARCH_LIMITS.defaultResults, 1), AREA_SEARCH_LIMITS.maxResults);
  const key = normalizeLocationText(query ?? "");
  // Typing fewer than two characters (or only punctuation) shows the default list. Text such as "zzzz" is a real
  // query even though normalization shortens it, so the length rule looks at what the user actually typed.
  const typedLength = (query ?? "").trim().length;

  if (key === "" || (key.length < AREA_SEARCH_LIMITS.minQueryLength && typedLength < AREA_SEARCH_LIMITS.minQueryLength)) {
    return queryAll<AreaOption>(
      db,
      `SELECT ${AREA_OPTION_COLUMNS}, NULL AS matchedAlias
       FROM areas a JOIN cities c ON c.id = a.city_id ${ACTIVE_CHAIN_JOINS}
       WHERE a.city_id = ? AND a.is_active = 1 AND c.is_active = 1 AND a.parent_area_id IS NULL
       ORDER BY a.search_priority DESC, a.name LIMIT ?`,
      [cityId, limit],
    );
  }

  // One row per area: the best-ranked alias that matched.
  const rows = await queryAll<AreaOption & { rank: number }>(
    db,
    `SELECT ${AREA_OPTION_COLUMNS}, al.alias AS matchedAlias,
            MIN(CASE WHEN al.normalized_alias = ? THEN 0
                     WHEN al.normalized_alias >= ? AND al.normalized_alias < ? THEN 1
                     ELSE 2 END) AS rank
     FROM area_aliases al
     JOIN areas a ON a.id = al.area_id AND a.is_active = 1
     JOIN cities c ON c.id = a.city_id ${ACTIVE_CHAIN_JOINS}
     WHERE al.city_id = ? AND c.is_active = 1 AND a.parent_area_id IS NULL
       AND (al.normalized_alias >= ? AND al.normalized_alias < ?
            OR al.normalized_alias LIKE ? ESCAPE '\\')
     GROUP BY a.id
     ORDER BY rank, a.search_priority DESC, a.name
     LIMIT ?`,
    [key, key, prefixUpperBound(key), cityId, key, prefixUpperBound(key), `%${escapeLike(key)}%`, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    nameBn: row.nameBn,
    slug: row.slug,
    areaType: row.areaType,
    parentAreaId: row.parentAreaId,
    matchedAlias: row.matchedAlias,
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------------------------------------------

export interface SitemapLocation {
  citySlug: string;
  areaSlug: string | null;
}

/** Every active city (areaSlug = null) and active area, for sitemap.xml. */
export function listSitemapLocations(db: D1Database): Promise<SitemapLocation[]> {
  return queryAll<SitemapLocation>(
    db,
    `SELECT c.slug AS citySlug, NULL AS areaSlug FROM cities c ${ACTIVE_CHAIN_JOINS} WHERE c.is_active = 1
     UNION ALL
     SELECT c.slug AS citySlug, a.slug AS areaSlug FROM areas a JOIN cities c ON c.id = a.city_id ${ACTIVE_CHAIN_JOINS}
     WHERE a.is_active = 1 AND c.is_active = 1`,
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Management foundation (used by the Milestone 7 admin screens; also by tests and seed tooling)
// ---------------------------------------------------------------------------------------------------------------

export interface CityInput {
  districtId: number;
  name: string;
  nameEn?: string | null;
  nameBn?: string | null;
  slug: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AreaInput {
  cityId: number;
  name: string;
  nameEn?: string | null;
  nameBn?: string | null;
  slug: string;
  areaType?: AreaType;
  parentAreaId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusM?: number | null;
  searchPriority?: number;
  description?: string | null;
  thana?: string | null;
  ward?: string | null;
  /** Extra spellings (Bangla, English, transliterations). The canonical names are always added automatically. */
  aliases?: readonly string[];
}

export type LocationWriteError =
  | { ok: false; reason: "slug_taken" }
  | { ok: false; reason: "alias_conflict"; alias: string; conflictingAreaId: number }
  | { ok: false; reason: "parent_not_found" }
  | { ok: false; reason: "area_not_found" }
  | { ok: false; reason: "empty_alias" };

export type CreateAreaResult = { ok: true; areaId: number } | LocationWriteError;

export async function createCity(db: D1Database, input: CityInput): Promise<{ ok: true; cityId: number } | { ok: false; reason: "slug_taken" }> {
  const taken = await queryFirst<{ id: number }>(db, "SELECT id FROM cities WHERE slug = ?", [input.slug]);
  if (taken) return { ok: false, reason: "slug_taken" };
  const result = await execute(
    db,
    `INSERT INTO cities (district_id, name, name_en, name_bn, slug, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.districtId, input.name, input.nameEn ?? input.name, input.nameBn ?? null, input.slug, input.latitude ?? null, input.longitude ?? null],
  );
  return { ok: true, cityId: Number(result.meta.last_row_id) };
}

/** Distinct (normalized key → display text) pairs for the canonical names and extra aliases of an area. */
function collectAliasTexts(input: Pick<AreaInput, "name" | "nameEn" | "nameBn" | "aliases">): Map<string, string> {
  const result = new Map<string, string>();
  for (const text of [input.name, input.nameEn ?? "", input.nameBn ?? "", ...(input.aliases ?? [])]) {
    const trimmed = text.trim();
    const key = normalizeLocationText(trimmed);
    if (key !== "" && !result.has(key)) result.set(key, trimmed);
  }
  return result;
}

/** The area that already owns this alias in the city, if any (aliases must never be ambiguous). */
export async function findAliasOwner(db: D1Database, cityId: number, normalizedAlias: string): Promise<number | null> {
  const row = await queryFirst<{ areaId: number }>(
    db,
    "SELECT area_id AS areaId FROM area_aliases WHERE city_id = ? AND normalized_alias = ?",
    [cityId, normalizedAlias],
  );
  return row?.areaId ?? null;
}

/**
 * Creates a neighborhood (or a sub-area when `parentAreaId` is set) together with its canonical aliases, atomically.
 * Rejects: duplicate slug in the city, a parent from another city, and any alias already owned by another area.
 */
export async function createArea(db: D1Database, input: AreaInput): Promise<CreateAreaResult> {
  const slugTaken = await queryFirst<{ id: number }>(db, "SELECT id FROM areas WHERE city_id = ? AND slug = ?", [input.cityId, input.slug]);
  if (slugTaken) return { ok: false, reason: "slug_taken" };

  if (input.parentAreaId != null) {
    const parent = await queryFirst<{ id: number }>(
      db,
      "SELECT id FROM areas WHERE id = ? AND city_id = ? AND parent_area_id IS NULL",
      [input.parentAreaId, input.cityId],
    );
    if (!parent) return { ok: false, reason: "parent_not_found" };
  }

  const aliasTexts = collectAliasTexts(input);
  for (const [key, text] of aliasTexts) {
    const owner = await findAliasOwner(db, input.cityId, key);
    if (owner !== null) return { ok: false, reason: "alias_conflict", alias: text, conflictingAreaId: owner };
  }

  const statements: Array<{ sql: string; params: SqlValue[] }> = [
    {
      sql: `INSERT INTO areas (city_id, name, name_en, name_bn, slug, area_type, parent_area_id, latitude, longitude,
                               radius_m, search_priority, description, thana, ward)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        input.cityId,
        input.name,
        input.nameEn ?? input.name,
        input.nameBn ?? null,
        input.slug,
        input.areaType ?? "neighborhood",
        input.parentAreaId ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        input.radiusM ?? null,
        input.searchPriority ?? 0,
        input.description ?? null,
        input.thana ?? null,
        input.ward ?? null,
      ],
    },
    ...[...aliasTexts].map(([key, text]) => ({
      sql: `INSERT INTO area_aliases (area_id, city_id, alias, normalized_alias, language)
            SELECT a.id, a.city_id, ?, ?, ? FROM areas a WHERE a.city_id = ? AND a.slug = ?`,
      params: [text, key, detectAliasLanguage(text), input.cityId, input.slug] as SqlValue[],
    })),
  ];
  await batch(db, statements);

  const created = await queryFirst<{ id: number }>(db, "SELECT id FROM areas WHERE city_id = ? AND slug = ?", [input.cityId, input.slug]);
  return { ok: true, areaId: created?.id ?? 0 };
}

export interface AreaUpdate {
  name?: string;
  nameEn?: string | null;
  nameBn?: string | null;
  areaType?: AreaType;
  latitude?: number | null;
  longitude?: number | null;
  radiusM?: number | null;
  searchPriority?: number;
  description?: string | null;
}

/** Updates descriptive fields of an area. Slug, city and parent are fixed once created (URLs and listings depend on them). */
export async function updateArea(db: D1Database, areaId: number, update: AreaUpdate): Promise<boolean> {
  const result = await execute(
    db,
    `UPDATE areas SET
       name = COALESCE(?, name),
       name_en = CASE WHEN ? = 1 THEN ? ELSE name_en END,
       name_bn = CASE WHEN ? = 1 THEN ? ELSE name_bn END,
       area_type = COALESCE(?, area_type),
       latitude = CASE WHEN ? = 1 THEN ? ELSE latitude END,
       longitude = CASE WHEN ? = 1 THEN ? ELSE longitude END,
       radius_m = CASE WHEN ? = 1 THEN ? ELSE radius_m END,
       search_priority = COALESCE(?, search_priority),
       description = CASE WHEN ? = 1 THEN ? ELSE description END,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
    [
      update.name ?? null,
      update.nameEn !== undefined ? 1 : 0, update.nameEn ?? null,
      update.nameBn !== undefined ? 1 : 0, update.nameBn ?? null,
      update.areaType ?? null,
      update.latitude !== undefined ? 1 : 0, update.latitude ?? null,
      update.longitude !== undefined ? 1 : 0, update.longitude ?? null,
      update.radiusM !== undefined ? 1 : 0, update.radiusM ?? null,
      update.searchPriority ?? null,
      update.description !== undefined ? 1 : 0, update.description ?? null,
      areaId,
    ],
  );
  return result.meta.changes > 0;
}

/** Soft switch: inactive areas disappear from every user-facing query but stay referenced by existing listings. */
export async function setAreaActive(db: D1Database, areaId: number, active: boolean): Promise<boolean> {
  const result = await execute(
    db,
    "UPDATE areas SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    [active ? 1 : 0, areaId],
  );
  return result.meta.changes > 0;
}

export async function listAreaAliases(db: D1Database, areaId: number): Promise<AreaAlias[]> {
  return queryAll<AreaAlias>(
    db,
    `SELECT id, area_id AS areaId, alias, normalized_alias AS normalizedAlias, language
     FROM area_aliases WHERE area_id = ? ORDER BY alias`,
    [areaId],
  );
}

/** Adds one spelling to an area. Refuses empty text and any spelling that already belongs to another area of the city. */
export async function addAreaAlias(
  db: D1Database,
  areaId: number,
  alias: string,
): Promise<{ ok: true } | LocationWriteError> {
  const text = alias.trim();
  const key = normalizeLocationText(text);
  if (key === "") return { ok: false, reason: "empty_alias" };

  const area = await queryFirst<{ cityId: number }>(db, "SELECT city_id AS cityId FROM areas WHERE id = ?", [areaId]);
  if (!area) return { ok: false, reason: "area_not_found" };

  const owner = await findAliasOwner(db, area.cityId, key);
  if (owner !== null && owner !== areaId) return { ok: false, reason: "alias_conflict", alias: text, conflictingAreaId: owner };
  if (owner === areaId) return { ok: true }; // already present: idempotent

  await execute(
    db,
    `INSERT OR IGNORE INTO area_aliases (area_id, city_id, alias, normalized_alias, language)
     VALUES (?, ?, ?, ?, ?)`,
    [areaId, area.cityId, text, key, detectAliasLanguage(text)],
  );
  return { ok: true };
}

export async function removeAreaAlias(db: D1Database, areaId: number, aliasId: number): Promise<boolean> {
  const result = await execute(db, "DELETE FROM area_aliases WHERE id = ? AND area_id = ?", [aliasId, areaId]);
  return result.meta.changes > 0;
}
