import type { Audience, AvailabilityStatus, ListingStatus, PropertyType } from "~/lib/constants";
import type { SearchParams } from "~/lib/validation/search";
import { batch, execute, queryAll, queryFirst, type SqlValue } from "../client";
import { buildListingSearchQuery } from "../listing-search";

/**
 * What an ANONYMOUS visitor may receive about a listing. Deliberately absent: internal id, exact address,
 * latitude/longitude, owner data, contact details and storage object keys.
 */
export interface ListingCard {
  slug: string;
  title: string;
  propertyType: PropertyType;
  availabilityStatus: AvailabilityStatus;
  rentAmount: number;
  mealCost: number | null;
  electricityCost: number | null;
  wifiCost: number | null;
  otherMonthlyCost: number | null;
  updatedAt: string;
  cityName: string;
  citySlug: string;
  areaName: string;
  areaSlug: string;
  /** Opaque image id served by /images/:id (only works while the listing is published). Never an object key. */
  coverImageId: string | null;
  /** Approximate distance from the requested search point, based on privacy-rounded coordinates. */
  approximateDistanceKm?: number | null;
}

export interface ListingSearchResult {
  items: ListingCard[];
  hasMore: boolean;
  page: number;
}

/** Public search: published listings only, one page at a time. */
export async function searchListings(db: D1Database, search: SearchParams): Promise<ListingSearchResult> {
  const { sql, params } = buildListingSearchQuery(search);
  const rows = await queryAll<ListingCard & { approximateDistanceSquared: number | null }>(db, sql, params);
  const items: ListingCard[] = rows.map(({ approximateDistanceSquared, ...listing }) => ({
    ...listing,
    approximateDistanceKm: approximateDistanceSquared === null || approximateDistanceSquared === undefined
      ? null
      : Math.sqrt(Math.max(0, approximateDistanceSquared)),
  }));
  return {
    items: items.slice(0, search.pageSize),
    hasMore: rows.length > search.pageSize,
    page: search.page,
  };
}

export interface ListingDetail extends ListingCard {
  description: string | null;
  advanceAmount: number | null;
  availableFrom: string | null;
}

/** Public detail page: only published listings are visible by slug. Exact address and coordinates stay private. */
export function getPublishedListingBySlug(db: D1Database, slug: string): Promise<ListingDetail | null> {
  return queryFirst<ListingDetail>(
    db,
    `SELECT l.slug, l.title, l.description, l.property_type AS propertyType,
            l.availability_status AS availabilityStatus, l.available_from AS availableFrom,
            l.rent_amount AS rentAmount, l.advance_amount AS advanceAmount, l.meal_cost AS mealCost,
            l.electricity_cost AS electricityCost, l.wifi_cost AS wifiCost,
            l.other_monthly_cost AS otherMonthlyCost, l.updated_at AS updatedAt,
            c.name AS cityName, c.slug AS citySlug, a.name AS areaName, a.slug AS areaSlug,
            (SELECT li.id FROM listing_images li WHERE li.listing_id = l.id
             ORDER BY li.sort_order ASC, li.id ASC LIMIT 1) AS coverImageId
     FROM listings l JOIN cities c ON c.id = l.city_id JOIN areas a ON a.id = l.area_id
     WHERE l.slug = ? AND l.status = 'published'`,
    [slug],
  );
}


/** Internal published listing id for server-side analytics only; never include this in public loader data. */
export async function getPublishedListingIdBySlug(db: D1Database, slug: string): Promise<string | null> {
  const row = await queryFirst<{ id: string }>(db,
    "SELECT id FROM listings WHERE slug = ? AND status = 'published' LIMIT 1", [slug]);
  return row?.id ?? null;
}

/** Public listing slugs for sitemap.xml. Never expose drafts, pending, paused, rejected or deleted listings. */
export function listPublishedListingSlugs(db: D1Database, limit: number = 50_000): Promise<Array<{ slug: string }>> {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(50_001, Math.floor(limit))) : 50_000;
  if (safeLimit === 0) return Promise.resolve([]);
  return queryAll<{ slug: string }>(
    db,
    `SELECT slug FROM listings
     WHERE status = 'published'
     ORDER BY published_at DESC, id DESC
     LIMIT ?`,
    [safeLimit],
  );
}

export interface OwnedListing {
  id: string;
  title: string | null;
  status: ListingStatus;
  propertyType: PropertyType;
}

/**
 * OWNERSHIP CHECK (blueprint §19): a listing is only returned when owner_id equals the
 * server-verified current user id. The id always comes from the session, never from the client.
 */
export function getOwnedListing(db: D1Database, listingId: string, ownerId: string): Promise<OwnedListing | null> {
  return queryFirst<OwnedListing>(
    db,
    `SELECT id, title, status, property_type AS propertyType
     FROM listings WHERE id = ? AND owner_id = ? AND status != 'deleted'`,
    [listingId, ownerId],
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Owner-side data access (Milestone 2). EVERY statement below filters by owner_id, and the owner id always comes
// from the verified session, never from the browser. "Deleted" listings are soft-deleted and invisible here.
// ---------------------------------------------------------------------------------------------------------------

/** Normalized, nullable values of a draft (what is written to the database). */
export interface DraftListingData {
  propertyType: PropertyType;
  title: string | null;
  description: string | null;
  cityId: number | null;
  areaId: number | null;
  subAreaId: number | null;
  address: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  rentAmount: number | null;
  advanceAmount: number | null;
  mealCost: number | null;
  electricityCost: number | null;
  wifiCost: number | null;
  otherMonthlyCost: number | null;
  availabilityStatus: AvailabilityStatus;
  availableFrom: string | null;
  audiences: Audience[];
  facilityIds: number[];
}

export interface OwnedListingDetail {
  id: string;
  title: string | null;
  description: string | null;
  propertyType: PropertyType;
  status: ListingStatus;
  availabilityStatus: AvailabilityStatus;
  availableFrom: string | null;
  cityId: number | null;
  areaId: number | null;
  subAreaId: number | null;
  address: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  rentAmount: number | null;
  advanceAmount: number | null;
  mealCost: number | null;
  electricityCost: number | null;
  wifiCost: number | null;
  otherMonthlyCost: number | null;
  updatedAt: string;
  rejectionReason: string | null;
  audiences: Audience[];
  facilityIds: number[];
}

export interface OwnedListingSummary {
  id: string;
  title: string | null;
  propertyType: PropertyType;
  status: ListingStatus;
  rentAmount: number | null;
  updatedAt: string;
  areaName: string | null;
  areaNameBn: string | null;
  cityName: string | null;
  cityNameBn: string | null;
  rejectionReason: string | null;
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Creates a DRAFT owned by `ownerId`, with its facilities and audiences, atomically. */
export async function createDraftListing(
  db: D1Database,
  ownerId: string,
  data: DraftListingData,
  ids: { id: string; slug: string },
): Promise<void> {
  await batch(db, [
    {
      sql: `INSERT INTO listings (id, owner_id, title, slug, description, property_type, status, availability_status,
              available_from, city_id, area_id, sub_area_id, address, landmark, latitude, longitude, rent_amount,
              advance_amount, meal_cost, electricity_cost, wifi_cost, other_monthly_cost)
            VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        ids.id, ownerId, data.title, ids.slug, data.description, data.propertyType, data.availabilityStatus,
        data.availableFrom, data.cityId, data.areaId, data.subAreaId, data.address, data.landmark, data.latitude,
        data.longitude, data.rentAmount, data.advanceAmount, data.mealCost, data.electricityCost, data.wifiCost,
        data.otherMonthlyCost,
      ],
    },
    ...data.facilityIds.map((facilityId) => ({
      sql: "INSERT OR IGNORE INTO listing_facilities (listing_id, facility_id) VALUES (?, ?)",
      params: [ids.id, facilityId] as SqlValue[],
    })),
    ...data.audiences.map((audience) => ({
      sql: "INSERT OR IGNORE INTO listing_audiences (listing_id, audience) VALUES (?, ?)",
      params: [ids.id, audience] as SqlValue[],
    })),
  ]);
}

const placeholders = (count: number) => Array.from({ length: count }, () => "?").join(", ");

/**
 * Replaces the editable fields of an owned listing (and its facilities/audiences) atomically.
 * `editable` lists the statuses in which this call may write. Every statement carries the same ownership+status
 * guard, and a batch is one transaction, so either all of it is applied or none of it.
 * A `published` or `paused` listing that is saved goes back to `pending` IN THE SAME STATEMENT (it leaves public
 * search immediately and needs a moderator again). Coordinates only change when new ones are supplied.
 * Returns false when the listing does not exist, belongs to someone else, or is not in an editable status.
 */
async function replaceListingContent(
  db: D1Database,
  listingId: string,
  ownerId: string,
  data: DraftListingData,
  editable: readonly ListingStatus[],
): Promise<boolean> {
  const statusList = placeholders(editable.length);
  const guardSql = `EXISTS (SELECT 1 FROM listings WHERE id = ? AND owner_id = ? AND status IN (${statusList}))`;
  const guard: SqlValue[] = [listingId, ownerId, ...editable];
  const results = await batch(db, [
    { sql: `DELETE FROM listing_facilities WHERE listing_id = ? AND ${guardSql}`, params: [listingId, ...guard] },
    { sql: `DELETE FROM listing_audiences WHERE listing_id = ? AND ${guardSql}`, params: [listingId, ...guard] },
    ...data.facilityIds.map((facilityId) => ({
      sql: `INSERT OR IGNORE INTO listing_facilities (listing_id, facility_id) SELECT ?, ? WHERE ${guardSql}`,
      params: [listingId, facilityId, ...guard] as SqlValue[],
    })),
    ...data.audiences.map((audience) => ({
      sql: `INSERT OR IGNORE INTO listing_audiences (listing_id, audience) SELECT ?, ? WHERE ${guardSql}`,
      params: [listingId, audience, ...guard] as SqlValue[],
    })),
    {
      sql: `UPDATE listings SET
              title = ?, description = ?, property_type = ?, availability_status = ?, available_from = ?,
              city_id = ?, area_id = ?, sub_area_id = ?, address = ?, landmark = ?,
              latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
              rent_amount = ?, advance_amount = ?, meal_cost = ?, electricity_cost = ?, wifi_cost = ?,
              other_monthly_cost = ?, updated_at = ${NOW},
              submitted_at = CASE WHEN status IN ('published', 'paused') THEN ${NOW} ELSE submitted_at END,
              status = CASE WHEN status IN ('published', 'paused') THEN 'pending' ELSE status END
            WHERE id = ? AND owner_id = ? AND status IN (${statusList})`,
      params: [
        data.title, data.description, data.propertyType, data.availabilityStatus, data.availableFrom, data.cityId,
        data.areaId, data.subAreaId, data.address, data.landmark, data.latitude, data.longitude, data.rentAmount,
        data.advanceAmount, data.mealCost, data.electricityCost, data.wifiCost, data.otherMonthlyCost, ...guard,
      ],
    },
  ]);
  return (results[results.length - 1]?.meta.changes ?? 0) > 0;
}

/** Edits an owned DRAFT only (status never changes). */
export function updateOwnedDraft(db: D1Database, listingId: string, ownerId: string, data: DraftListingData): Promise<boolean> {
  return replaceListingContent(db, listingId, ownerId, data, ["draft"]);
}

/** Edits an owned listing in any editable status; live (published/paused) listings are sent back to moderation. */
export function updateOwnedListingContent(
  db: D1Database,
  listingId: string,
  ownerId: string,
  data: DraftListingData,
  editable: readonly ListingStatus[],
): Promise<boolean> {
  return replaceListingContent(db, listingId, ownerId, data, editable);
}

/**
 * Compare-and-set submission: only an owned draft/rejected/paused listing that has at least one image moves to
 * `pending`. The database trigger from migration 0008 enforces the same rules again.
 */
export async function submitOwnedListing(
  db: D1Database,
  listingId: string,
  ownerId: string,
  submittable: readonly ListingStatus[],
): Promise<boolean> {
  const result = await execute(
    db,
    `UPDATE listings SET status = 'pending', submitted_at = ${NOW}, updated_at = ${NOW}
     WHERE id = ? AND owner_id = ? AND status IN (${placeholders(submittable.length)})
       AND EXISTS (SELECT 1 FROM listing_images WHERE listing_id = listings.id)`,
    [listingId, ownerId, ...submittable],
  );
  return result.meta.changes > 0;
}

/** Full editable view of one of the owner's listings (null for other people's, missing or deleted listings). */
export async function getOwnedListingDetail(
  db: D1Database,
  listingId: string,
  ownerId: string,
): Promise<OwnedListingDetail | null> {
  const row = await queryFirst<Omit<OwnedListingDetail, "audiences" | "facilityIds">>(
    db,
    `SELECT id, title, description, property_type AS propertyType, status, availability_status AS availabilityStatus,
            available_from AS availableFrom, city_id AS cityId, area_id AS areaId, sub_area_id AS subAreaId, address,
            landmark, latitude, longitude, rent_amount AS rentAmount, advance_amount AS advanceAmount,
            meal_cost AS mealCost, electricity_cost AS electricityCost, wifi_cost AS wifiCost,
            other_monthly_cost AS otherMonthlyCost, updated_at AS updatedAt, rejection_reason AS rejectionReason
     FROM listings WHERE id = ? AND owner_id = ? AND status != 'deleted'`,
    [listingId, ownerId],
  );
  if (!row) return null;
  const [facilities, audiences] = await Promise.all([
    queryAll<{ facilityId: number }>(db, "SELECT facility_id AS facilityId FROM listing_facilities WHERE listing_id = ? ORDER BY facility_id", [listingId]),
    queryAll<{ audience: Audience }>(db, "SELECT audience FROM listing_audiences WHERE listing_id = ? ORDER BY audience", [listingId]),
  ]);
  return { ...row, facilityIds: facilities.map((f) => f.facilityId), audiences: audiences.map((a) => a.audience) };
}

/** The current user's listings (newest activity first). Other users' and deleted listings never appear. */
export function listOwnedListings(db: D1Database, ownerId: string, limit: number = 100): Promise<OwnedListingSummary[]> {
  return queryAll<OwnedListingSummary>(
    db,
    `SELECT l.id, l.title, l.property_type AS propertyType, l.status, l.rent_amount AS rentAmount,
            l.updated_at AS updatedAt, a.name AS areaName, a.name_bn AS areaNameBn,
            c.name AS cityName, c.name_bn AS cityNameBn, l.rejection_reason AS rejectionReason
     FROM listings l
     LEFT JOIN areas a ON a.id = l.area_id
     LEFT JOIN cities c ON c.id = l.city_id
     WHERE l.owner_id = ? AND l.status != 'deleted'
     ORDER BY l.updated_at DESC, l.id DESC LIMIT ?`,
    [ownerId, limit],
  );
}

/**
 * Compare-and-set status change of an owned listing: only succeeds when the listing is owned by `ownerId` AND
 * currently has status `from`. Whether `from → to` is an allowed transition is decided by the caller (service layer).
 */
export async function setOwnedListingStatus(
  db: D1Database,
  listingId: string,
  ownerId: string,
  from: ListingStatus,
  to: ListingStatus,
): Promise<boolean> {
  const result = await execute(
    db,
    `UPDATE listings SET status = ?, updated_at = ${NOW} WHERE id = ? AND owner_id = ? AND status = ?`,
    [to, listingId, ownerId, from],
  );
  return result.meta.changes > 0;
}
