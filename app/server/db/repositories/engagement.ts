import type { ReportReason } from "~/lib/constants";
import type { ListingCard } from "./listings";
import { execute, queryAll, queryFirst } from "../client";

/** Published listings saved by the session user. Never includes drafts or private listing fields. */
export function listFavoriteListings(db: D1Database, userId: string): Promise<ListingCard[]> {
  return queryAll<ListingCard>(db,
    `SELECT l.slug, l.title, l.property_type AS propertyType, l.availability_status AS availabilityStatus,
            l.rent_amount AS rentAmount, l.meal_cost AS mealCost, l.electricity_cost AS electricityCost,
            l.wifi_cost AS wifiCost, l.other_monthly_cost AS otherMonthlyCost, l.updated_at AS updatedAt,
            c.name AS cityName, c.slug AS citySlug, a.name AS areaName, a.slug AS areaSlug,
            (SELECT li.id FROM listing_images li WHERE li.listing_id = l.id ORDER BY li.sort_order, li.id LIMIT 1) AS coverImageId
     FROM favorites f JOIN listings l ON l.id = f.listing_id
     JOIN cities c ON c.id = l.city_id JOIN areas a ON a.id = l.area_id
     WHERE f.user_id = ? AND l.status = 'published'
     ORDER BY f.created_at DESC, l.updated_at DESC`, [userId]);
}

export async function isListingFavorite(db: D1Database, userId: string, slug: string): Promise<boolean> {
  const row = await queryFirst<{ found: number }>(db,
    `SELECT 1 AS found FROM favorites f JOIN listings l ON l.id = f.listing_id
     WHERE f.user_id = ? AND l.slug = ? AND l.status = 'published'`, [userId, slug]);
  return row !== null;
}

/** Server-side ownership check used to avoid showing a non-functional Save button on the owner's own public listing. */
export async function isPublishedListingOwner(db: D1Database, userId: string, slug: string): Promise<boolean> {
  const row = await queryFirst<{ found: number }>(db,
    `SELECT 1 AS found FROM listings l
     WHERE l.owner_id = ? AND l.slug = ? AND l.status = 'published'`, [userId, slug]);
  return row !== null;
}

/** Atomically toggles a published listing favorite; the listing owner cannot save their own listing. */
export async function toggleListingFavorite(db: D1Database, userId: string, slug: string): Promise<boolean> {
  const existing = await queryFirst<{ listingId: string }>(db,
    `SELECT l.id AS listingId FROM favorites f JOIN listings l ON l.id = f.listing_id
     WHERE f.user_id = ? AND l.slug = ? AND l.status = 'published'`, [userId, slug]);
  if (existing) {
    await execute(db, "DELETE FROM favorites WHERE user_id = ? AND listing_id = ?", [userId, existing.listingId]);
    return false;
  }
  const result = await execute(db,
    `INSERT OR IGNORE INTO favorites (user_id, listing_id)
     SELECT ?, l.id FROM listings l WHERE l.slug = ? AND l.status = 'published' AND l.owner_id <> ?`,
    [userId, slug, userId]);
  return result.meta.changes > 0;
}

export interface PublicListingExtras {
  images: { id: string; altText: string | null }[];
  facilities: string[];
  audiences: string[];
  ownerName: string | null;
  phone: string | null;
  whatsapp: string | null;
  landmark: string | null;
}

/** Safe public detail extras; deliberately excludes exact address, coordinates, owner id and storage keys. */
export async function getPublicListingExtras(db: D1Database, slug: string): Promise<PublicListingExtras> {
  const base = await queryFirst<{ id: string; ownerName: string | null; phone: string | null; whatsapp: string | null; landmark: string | null }>(db,
    `SELECT l.id, p.display_name AS ownerName, p.phone, p.whatsapp, l.landmark
     FROM listings l LEFT JOIN profiles p ON p.user_id = l.owner_id
     WHERE l.slug = ? AND l.status = 'published'`, [slug]);
  if (!base) return { images: [], facilities: [], audiences: [], ownerName: null, phone: null, whatsapp: null, landmark: null };
  const [images, facilities, audiences] = await Promise.all([
    queryAll<{ id: string; altText: string | null }>(db,
      "SELECT id, alt_text AS altText FROM listing_images WHERE listing_id = ? ORDER BY sort_order, id", [base.id]),
    queryAll<{ name: string }>(db,
      `SELECT f.name FROM listing_facilities lf JOIN facilities f ON f.id = lf.facility_id
       WHERE lf.listing_id = ? AND f.is_active = 1 ORDER BY f.sort_order, f.name`, [base.id]),
    queryAll<{ audience: string }>(db,
      "SELECT audience FROM listing_audiences WHERE listing_id = ? ORDER BY audience", [base.id]),
  ]);
  return { images, facilities: facilities.map((f) => f.name), audiences: audiences.map((a) => a.audience),
    ownerName: base.ownerName, phone: base.phone, whatsapp: base.whatsapp, landmark: base.landmark };
}

export async function submitListingReport(db: D1Database, input: {
  id: string; slug: string; reporterId: string; reason: ReportReason; details: string | null;
}): Promise<boolean> {
  const result = await execute(db,
    `INSERT INTO reports (id, listing_id, reporter_id, reason, details)
     SELECT ?, l.id, ?, ?, ? FROM listings l
     WHERE l.slug = ? AND l.status = 'published' AND l.owner_id <> ?
       AND NOT EXISTS (SELECT 1 FROM reports r WHERE r.listing_id = l.id AND r.reporter_id = ? AND r.status = 'pending')
       AND (SELECT COUNT(*) FROM reports recent
            WHERE recent.reporter_id = ?
              AND recent.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')) < 10`,
    [input.id, input.reporterId, input.reason, input.details, input.slug, input.reporterId, input.reporterId, input.reporterId]);
  return result.meta.changes > 0;
}
