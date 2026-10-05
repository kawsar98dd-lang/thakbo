import type { Audience, AvailabilityStatus, ListingStatus, PropertyType } from "~/lib/constants";
import type { SearchParams } from "~/lib/validation/search";
import { batch, execute, queryAll, queryFirst, type SqlValue } from "../client";
import { buildListingSearchQuery } from "../listing-search";

export interface ListingCard {
  id: string;
  slug: string;
  title: string;
  propertyType: PropertyType;
  availabilityStatus: AvailabilityStatus;
  rentAmount: number;
  mealCost: number | null;
  electricityCost: number | null;
  wifiCost: number | null;
  otherMonthlyCost: number | null;
  latitude: number;
  longitude: number;
  updatedAt: string;
  cityName: string;
  citySlug: string;
  areaName: string;
  areaSlug: string;
  coverImageKey: string | null;
}

export interface ListingSearchResult {
  items: ListingCard[];
  hasMore: boolean;
  page: number;
}

/** Public search: published listings only, one page at a time. */
export async function searchListings(db: D1Database, search: SearchParams): Promise<ListingSearchResult> {
  const { sql, params } = buildListingSearchQuery(search);
  const rows = await queryAll<ListingCard>(db, sql, params);
  return {
    items: rows.slice(0, search.pageSize),
    hasMore: rows.length > search.pageSize,
    page: search.page,
  };
}

export interface ListingDetail extends ListingCard {
  description: string | null;
  address: string | null;
  advanceAmount: number | null;
  availableFrom: string | null;
}

/** Public detail page: only published listings are visible by slug. */
export function getPublishedListingBySlug(db: D1Database, slug: string): Promise<ListingDetail | null> {
  return queryFirst<ListingDetail>(
    db,
    `SELECT l.id, l.slug, l.title, l.description, l.address, l.property_type AS propertyType,
            l.availability_status AS availabilityStatus, l.available_from AS availableFrom,
            l.rent_amount AS rentAmount, l.advance_amount AS advanceAmount, l.meal_cost AS mealCost,
            l.electricity_cost AS electricityCost, l.wifi_cost AS wifiCost,
            l.other_monthly_cost AS otherMonthlyCost, l.latitude, l.longitude, l.updated_at AS updatedAt,
            c.name AS cityName, c.slug AS citySlug, a.name AS areaName, a.slug AS areaSlug,
            NULL AS coverImageKey
     FROM listings l JOIN cities c ON c.id = l.city_id JOIN areas a ON a.id = l.area_id
     WHERE l.slug = ? AND l.status = 'published'`,
    [slug],
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
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Guard used inside batched statements so they only touch an owned DRAFT. */
const OWNED_DRAFT_EXISTS =
  "EXISTS (SELECT 1 FROM listings WHERE id = ? AND owner_id = ? AND status = 'draft')";

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

/**
 * Replaces the editable fields of an owned DRAFT (and its facilities/audiences) atomically.
 * Returns false when the listing does not exist, belongs to someone else, or is no longer a draft.
 * Coordinates are only changed when new ones are supplied (the map picker arrives in a later milestone).
 */
export async function updateOwnedDraft(
  db: D1Database,
  listingId: string,
  ownerId: string,
  data: DraftListingData,
): Promise<boolean> {
  const guard: SqlValue[] = [listingId, ownerId];
  const results = await batch(db, [
    {
      sql: `UPDATE listings SET
              title = ?, description = ?, property_type = ?, availability_status = ?, available_from = ?,
              city_id = ?, area_id = ?, sub_area_id = ?, address = ?, landmark = ?,
              latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
              rent_amount = ?, advance_amount = ?, meal_cost = ?, electricity_cost = ?, wifi_cost = ?,
              other_monthly_cost = ?, updated_at = ${NOW}
            WHERE id = ? AND owner_id = ? AND status = 'draft'`,
      params: [
        data.title, data.description, data.propertyType, data.availabilityStatus, data.availableFrom, data.cityId,
        data.areaId, data.subAreaId, data.address, data.landmark, data.latitude, data.longitude, data.rentAmount,
        data.advanceAmount, data.mealCost, data.electricityCost, data.wifiCost, data.otherMonthlyCost, ...guard,
      ],
    },
    {
      sql: `DELETE FROM listing_facilities WHERE listing_id = ? AND ${OWNED_DRAFT_EXISTS}`,
      params: [listingId, ...guard],
    },
    {
      sql: `DELETE FROM listing_audiences WHERE listing_id = ? AND ${OWNED_DRAFT_EXISTS}`,
      params: [listingId, ...guard],
    },
    ...data.facilityIds.map((facilityId) => ({
      sql: `INSERT OR IGNORE INTO listing_facilities (listing_id, facility_id)
            SELECT ?, ? WHERE ${OWNED_DRAFT_EXISTS}`,
      params: [listingId, facilityId, ...guard] as SqlValue[],
    })),
    ...data.audiences.map((audience) => ({
      sql: `INSERT OR IGNORE INTO listing_audiences (listing_id, audience)
            SELECT ?, ? WHERE ${OWNED_DRAFT_EXISTS}`,
      params: [listingId, audience, ...guard] as SqlValue[],
    })),
  ]);
  return (results[0]?.meta.changes ?? 0) > 0;
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
            other_monthly_cost AS otherMonthlyCost, updated_at AS updatedAt
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
            c.name AS cityName, c.name_bn AS cityNameBn
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
