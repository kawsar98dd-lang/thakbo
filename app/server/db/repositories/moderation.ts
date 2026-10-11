import { REVIEWABLE_STATUSES, type Audience, type ListingStatus, type ModerationAction, type PropertyType, type AvailabilityStatus } from "~/lib/constants";
import { execute, queryAll, queryFirst } from "../client";

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export interface ListingOwnerStatus {
  id: string;
  ownerId: string;
  status: ListingStatus;
}

export function getListingOwnerStatus(db: D1Database, listingId: string): Promise<ListingOwnerStatus | null> {
  return queryFirst<ListingOwnerStatus>(db, "SELECT id, owner_id AS ownerId, status FROM listings WHERE id = ?", [listingId]);
}

/**
 * Compare-and-set approval. Succeeds only while the listing is still `pending` AND the reviewer is not its owner.
 * Whether the reviewer is a registered admin/moderator is checked by the service and again by the database trigger.
 */
export async function approvePendingListing(db: D1Database, listingId: string, reviewerId: string): Promise<boolean> {
  const result = await execute(
    db,
    `UPDATE listings SET status = 'published', reviewed_by = ?, reviewed_at = ${NOW}, published_at = ${NOW},
            rejection_reason = NULL, updated_at = ${NOW}
     WHERE id = ? AND status = 'pending' AND owner_id <> ?`,
    [reviewerId, listingId, reviewerId],
  );
  return result.meta.changes > 0;
}

export async function rejectPendingListing(db: D1Database, listingId: string, reviewerId: string, reason: string): Promise<boolean> {
  const result = await execute(
    db,
    `UPDATE listings SET status = 'rejected', reviewed_by = ?, reviewed_at = ${NOW}, rejection_reason = ?, updated_at = ${NOW}
     WHERE id = ? AND status = 'pending' AND owner_id <> ?`,
    [reviewerId, reason, listingId, reviewerId],
  );
  return result.meta.changes > 0;
}

export interface ModerationQueueItem {
  id: string;
  title: string | null;
  propertyType: PropertyType;
  status: ListingStatus;
  rentAmount: number | null;
  submittedAt: string | null;
  updatedAt: string;
  areaName: string | null;
  cityName: string | null;
  ownerName: string | null;
  imageCount: number;
}

/** Oldest submission first, so nobody waits forever. Only reviewable statuses; drafts and deleted listings never appear. */
export function listListingsForModeration(db: D1Database, status: ListingStatus, limit: number = 100): Promise<ModerationQueueItem[]> {
  if (!REVIEWABLE_STATUSES.includes(status)) return Promise.resolve([]);
  return queryAll<ModerationQueueItem>(
    db,
    `SELECT l.id, l.title, l.property_type AS propertyType, l.status, l.rent_amount AS rentAmount,
            l.submitted_at AS submittedAt, l.updated_at AS updatedAt, a.name AS areaName, c.name AS cityName,
            p.display_name AS ownerName,
            (SELECT COUNT(*) FROM listing_images li WHERE li.listing_id = l.id) AS imageCount
     FROM listings l
     LEFT JOIN areas a ON a.id = l.area_id
     LEFT JOIN cities c ON c.id = l.city_id
     LEFT JOIN profiles p ON p.user_id = l.owner_id
     WHERE l.status = ?
     ORDER BY COALESCE(l.submitted_at, l.updated_at) ASC, l.id ASC LIMIT ?`,
    [status, limit],
  );
}

export interface ListingForReview {
  id: string;
  ownerId: string;
  status: ListingStatus;
  title: string | null;
  description: string | null;
  propertyType: PropertyType;
  availabilityStatus: AvailabilityStatus;
  availableFrom: string | null;
  cityName: string | null;
  areaName: string | null;
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
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerWhatsapp: string | null;
  audiences: Audience[];
  facilities: string[];
  imageIds: string[];
}

/**
 * Everything a moderator needs, INCLUDING private data (exact address, coordinates, owner contact numbers).
 * Callers must have passed requireAdmin; this function is never used by a public route.
 */
export async function getListingForReview(db: D1Database, listingId: string): Promise<ListingForReview | null> {
  const row = await queryFirst<Omit<ListingForReview, "audiences" | "facilities" | "imageIds">>(
    db,
    `SELECT l.id, l.owner_id AS ownerId, l.status, l.title, l.description, l.property_type AS propertyType,
            l.availability_status AS availabilityStatus, l.available_from AS availableFrom,
            c.name AS cityName, a.name AS areaName, l.address, l.landmark, l.latitude, l.longitude,
            l.rent_amount AS rentAmount, l.advance_amount AS advanceAmount, l.meal_cost AS mealCost,
            l.electricity_cost AS electricityCost, l.wifi_cost AS wifiCost, l.other_monthly_cost AS otherMonthlyCost,
            l.rejection_reason AS rejectionReason, l.submitted_at AS submittedAt, l.reviewed_at AS reviewedAt,
            p.display_name AS ownerName, p.phone AS ownerPhone, p.whatsapp AS ownerWhatsapp
     FROM listings l
     LEFT JOIN cities c ON c.id = l.city_id
     LEFT JOIN areas a ON a.id = l.area_id
     LEFT JOIN profiles p ON p.user_id = l.owner_id
     WHERE l.id = ? AND l.status IN ('pending', 'published', 'paused', 'rejected')`,
    [listingId],
  );
  if (!row) return null;
  const [audiences, facilities, images] = await Promise.all([
    queryAll<{ audience: Audience }>(db, "SELECT audience FROM listing_audiences WHERE listing_id = ? ORDER BY audience", [listingId]),
    queryAll<{ name: string }>(
      db,
      `SELECT f.name FROM listing_facilities lf JOIN facilities f ON f.id = lf.facility_id WHERE lf.listing_id = ? ORDER BY f.name`,
      [listingId],
    ),
    queryAll<{ id: string }>(db, "SELECT id FROM listing_images WHERE listing_id = ? ORDER BY sort_order ASC, id ASC", [listingId]),
  ]);
  return { ...row, audiences: audiences.map((a) => a.audience), facilities: facilities.map((f) => f.name), imageIds: images.map((i) => i.id) };
}

export interface ModerationEvent {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: "owner" | "admin" | "moderator";
  action: ModerationAction;
  fromStatus: ListingStatus;
  toStatus: ListingStatus;
  reason: string | null;
  createdAt: string;
}

/** Newest first. `rowid` breaks ties between events created in the same millisecond. */
export function listModerationEvents(db: D1Database, listingId: string, limit: number = 50): Promise<ModerationEvent[]> {
  return queryAll<ModerationEvent>(
    db,
    `SELECT e.id, e.actor_id AS actorId, u.name AS actorName, e.actor_role AS actorRole, e.action,
            e.from_status AS fromStatus, e.to_status AS toStatus, e.reason, e.created_at AS createdAt
     FROM listing_moderation_events e LEFT JOIN "user" u ON u.id = e.actor_id
     WHERE e.listing_id = ? ORDER BY e.created_at DESC, e.rowid DESC LIMIT ?`,
    [listingId, limit],
  );
}
