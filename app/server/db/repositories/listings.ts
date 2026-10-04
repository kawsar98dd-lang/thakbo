import type { AvailabilityStatus, ListingStatus, PropertyType } from "~/lib/constants";
import type { SearchParams } from "~/lib/validation/search";
import { queryAll, queryFirst } from "../client";
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
