import { queryAll, queryFirst } from "../client";

export interface City {
  id: number;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Area {
  id: number;
  cityId: number;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
}

const CITY_COLUMNS = "id, name, slug, latitude, longitude";
const AREA_COLUMNS = "id, city_id AS cityId, name, slug, latitude, longitude";

export function listActiveCities(db: D1Database): Promise<City[]> {
  return queryAll<City>(db, `SELECT ${CITY_COLUMNS} FROM cities WHERE is_active = 1 ORDER BY name`);
}

export function getCityBySlug(db: D1Database, slug: string): Promise<City | null> {
  return queryFirst<City>(db, `SELECT ${CITY_COLUMNS} FROM cities WHERE slug = ? AND is_active = 1`, [slug]);
}

export function listActiveAreas(db: D1Database, cityId: number): Promise<Area[]> {
  return queryAll<Area>(db, `SELECT ${AREA_COLUMNS} FROM areas WHERE city_id = ? AND is_active = 1 ORDER BY name`, [cityId]);
}

export function getAreaBySlug(db: D1Database, cityId: number, slug: string): Promise<Area | null> {
  return queryFirst<Area>(
    db,
    `SELECT ${AREA_COLUMNS} FROM areas WHERE city_id = ? AND slug = ? AND is_active = 1`,
    [cityId, slug],
  );
}

export interface SitemapLocation {
  citySlug: string;
  areaSlug: string | null;
}

/** Every active city (areaSlug = null) and active area, for sitemap.xml. */
export function listSitemapLocations(db: D1Database): Promise<SitemapLocation[]> {
  return queryAll<SitemapLocation>(
    db,
    `SELECT c.slug AS citySlug, NULL AS areaSlug FROM cities c WHERE c.is_active = 1
     UNION ALL
     SELECT c.slug AS citySlug, a.slug AS areaSlug FROM areas a JOIN cities c ON c.id = a.city_id
     WHERE a.is_active = 1 AND c.is_active = 1`,
  );
}
