import { boundingBox } from "~/lib/geo";
import type { SearchParams } from "~/lib/validation/search";
import type { SearchSort } from "~/lib/constants";
import type { SqlValue } from "./client";

/**
 * Pure SQL builder for public listing search (no database access, so it is unit-tested).
 *
 * SAFETY RULES
 *  - User input only ever appears in `params` (bound with `?`), never inside the SQL text.
 *  - ORDER BY comes from the fixed SORT_SQL map below, selected by an already-validated enum.
 *  - Only `status = 'published'` listings are ever returned.
 */

const SORT_SQL: Record<SearchSort, string> = {
  newest: "l.published_at DESC, l.id DESC",
  price_asc: "l.rent_amount ASC, l.id ASC",
  price_desc: "l.rent_amount DESC, l.id ASC",
  updated: "l.updated_at DESC, l.id DESC",
  distance: "distanceSquared ASC, l.published_at DESC, l.id ASC",
};

const placeholders = (count: number) => Array.from({ length: count }, () => "?").join(", ");

export interface BuiltQuery {
  sql: string;
  params: SqlValue[];
}

/**
 * PRIVACY: this projection is sent to anonymous visitors. It must never contain the internal listing id, the exact
 * address, latitude/longitude, owner data, contact details or storage object keys (a test enforces this).
 * Coordinates may still be used in WHERE clauses below, but are never selected.
 */
export const LISTING_CARD_COLUMNS = `
  l.slug, l.title, l.property_type AS propertyType, l.availability_status AS availabilityStatus,
  l.rent_amount AS rentAmount, l.meal_cost AS mealCost, l.electricity_cost AS electricityCost,
  l.wifi_cost AS wifiCost, l.other_monthly_cost AS otherMonthlyCost, l.updated_at AS updatedAt,
  c.name AS cityName, c.slug AS citySlug, a.name AS areaName, a.slug AS areaSlug,
  (SELECT li.id FROM listing_images li WHERE li.listing_id = l.id
   ORDER BY li.sort_order ASC, li.id ASC LIMIT 1) AS coverImageId`;

export function buildListingSearchQuery(search: SearchParams): BuiltQuery {
  const where: string[] = ["l.status = 'published'"];
  const params: SqlValue[] = [];
  const pointProvided = search.lat !== undefined && search.lng !== undefined;
  const lat = search.lat ?? 0;
  const lng = search.lng ?? 0;
  // Privacy: only use coordinates rounded to 2 decimals (~1 km grid) for radius filtering/sorting.
  // Using exact owner pins in WHERE would let anonymous users triangulate a property by repeatedly probing radii.
  // Equirectangular distance is an approximation; longitude degrees shrink with latitude, approximated without SQLite extensions.
  const distanceSquared = `(((ROUND(l.latitude, 2) - ?) * 111.32) * ((ROUND(l.latitude, 2) - ?) * 111.32) + ((ROUND(l.longitude, 2) - ?) * (111.32 * (1 - (? * ? * 0.0001523)))) * ((ROUND(l.longitude, 2) - ?) * (111.32 * (1 - (? * ? * 0.0001523)))) )`;

  if (search.city) {
    where.push("c.slug = ?");
    params.push(search.city);
  }
  if (search.area) {
    where.push("a.slug = ?");
    params.push(search.area);
  }
  if (search.types.length > 0) {
    where.push(`l.property_type IN (${placeholders(search.types.length)})`);
    params.push(...search.types);
  }
  if (search.audiences.length > 0) {
    where.push(
      `EXISTS (SELECT 1 FROM listing_audiences la WHERE la.listing_id = l.id AND la.audience IN (${placeholders(search.audiences.length)}))`,
    );
    params.push(...search.audiences);
  }
  if (search.facilities.length > 0) {
    // The listing must have ALL requested facilities.
    where.push(
      `(SELECT COUNT(DISTINCT f.slug) FROM listing_facilities lf JOIN facilities f ON f.id = lf.facility_id
        WHERE lf.listing_id = l.id AND f.slug IN (${placeholders(search.facilities.length)})) = ?`,
    );
    params.push(...search.facilities, search.facilities.length);
  }
  if (search.minPrice !== undefined) {
    where.push("l.rent_amount >= ?");
    params.push(search.minPrice);
  }
  if (search.maxPrice !== undefined) {
    where.push("l.rent_amount <= ?");
    params.push(search.maxPrice);
  }
  if (search.availableNow) {
    where.push("l.availability_status = 'available'");
  } else if (search.availableBy) {
    where.push("(l.availability_status = 'available' OR (l.availability_status = 'available_from' AND l.available_from <= ?))");
    params.push(search.availableBy);
  }
  if (search.lat !== undefined && search.lng !== undefined && search.radiusKm !== undefined) {
    const box = boundingBox({ latitude: search.lat, longitude: search.lng }, search.radiusKm);
    // The indexed prefilter compares coordinates rounded to 2 decimals. Expand the box by half a grid cell
    // so rounding near a radius edge does not incorrectly discard a candidate before the distance check.
    const gridPadding = 0.0051;
    where.push("ROUND(l.latitude, 2) BETWEEN ? AND ? AND ROUND(l.longitude, 2) BETWEEN ? AND ?");
    params.push(
      Math.max(-90, box.minLat - gridPadding), Math.min(90, box.maxLat + gridPadding),
      Math.max(-180, box.minLng - gridPadding), Math.min(180, box.maxLng + gridPadding),
    );
    // Apply a distance check after the indexed bounding-box prefilter, not just the rectangle.
    where.push(`${distanceSquared} <= (? * ?)`);
    params.push(search.lat, search.lat, search.lng, search.lat, search.lat, search.lng, search.lat, search.lat, search.radiusKm, search.radiusKm);
  }

  // Fetch one extra row so the caller knows whether another page exists (no COUNT(*) scan).
  const limit = search.pageSize + 1;
  const offset = (search.page - 1) * search.pageSize;

  const useDistanceSort = search.sort === "distance" && pointProvided;
  const orderBy = useDistanceSort ? distanceSquared : search.sort === "distance" ? SORT_SQL.newest : SORT_SQL[search.sort];
  // Return only an approximate distance derived from coordinates rounded to a 0.01-degree grid.
  // Never select the listing's actual latitude/longitude into public search results.
  const selectDistance = pointProvided ? `${distanceSquared} AS approximateDistanceSquared` : "NULL AS approximateDistanceSquared";
  const selectParams: SqlValue[] = pointProvided ? [lat, lat, lng, lat, lat, lng, lat, lat] : [];
  const sql = `SELECT ${LISTING_CARD_COLUMNS}, ${selectDistance}
FROM listings l
JOIN cities c ON c.id = l.city_id
JOIN areas a ON a.id = l.area_id
WHERE ${where.join("\n  AND ")}
ORDER BY ${orderBy}
LIMIT ? OFFSET ?`;
  const orderParams: SqlValue[] = useDistanceSort ? [lat, lat, lng, lat, lat, lng, lat, lat] : [];
  return { sql, params: [...selectParams, ...params, ...orderParams, limit, offset] };
}
