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
};

const placeholders = (count: number) => Array.from({ length: count }, () => "?").join(", ");

export interface BuiltQuery {
  sql: string;
  params: SqlValue[];
}

export const LISTING_CARD_COLUMNS = `
  l.id, l.slug, l.title, l.property_type AS propertyType, l.availability_status AS availabilityStatus,
  l.rent_amount AS rentAmount, l.meal_cost AS mealCost, l.electricity_cost AS electricityCost,
  l.wifi_cost AS wifiCost, l.other_monthly_cost AS otherMonthlyCost,
  l.latitude, l.longitude, l.updated_at AS updatedAt,
  c.name AS cityName, c.slug AS citySlug, a.name AS areaName, a.slug AS areaSlug,
  (SELECT li.object_key FROM listing_images li WHERE li.listing_id = l.id
   ORDER BY li.sort_order ASC, li.id ASC LIMIT 1) AS coverImageKey`;

export function buildListingSearchQuery(search: SearchParams): BuiltQuery {
  const where: string[] = ["l.status = 'published'"];
  const params: SqlValue[] = [];

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
    // Cheap indexed pre-filter. Exact distance/sorting by distance arrives with Milestone 4.
    const box = boundingBox({ latitude: search.lat, longitude: search.lng }, search.radiusKm);
    where.push("l.latitude BETWEEN ? AND ? AND l.longitude BETWEEN ? AND ?");
    params.push(box.minLat, box.maxLat, box.minLng, box.maxLng);
  }

  // Fetch one extra row so the caller knows whether another page exists (no COUNT(*) scan).
  const limit = search.pageSize + 1;
  const offset = (search.page - 1) * search.pageSize;

  const sql = `SELECT ${LISTING_CARD_COLUMNS}
FROM listings l
JOIN cities c ON c.id = l.city_id
JOIN areas a ON a.id = l.area_id
WHERE ${where.join("\n  AND ")}
ORDER BY ${SORT_SQL[search.sort]}
LIMIT ? OFFSET ?`;

  return { sql, params: [...params, limit, offset] };
}
