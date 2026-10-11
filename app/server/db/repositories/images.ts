import { IMAGE_EDITABLE_STATUSES, type ListingStatus } from "~/lib/constants";
import { execute, queryAll, queryFirst, type SqlValue } from "../client";

export interface ListingImageRef {
  id: string;
  sortOrder: number;
}

const editableList = IMAGE_EDITABLE_STATUSES.map(() => "?").join(", ");
const OWNED_EDITABLE = `l.id = ? AND l.owner_id = ? AND l.status IN (${editableList})`;
const ownedEditableParams = (listingId: string, ownerId: string): SqlValue[] => [listingId, ownerId, ...IMAGE_EDITABLE_STATUSES];

/** Opaque image ids in display order. Object keys are never returned by this function. */
export function listListingImages(db: D1Database, listingId: string): Promise<ListingImageRef[]> {
  return queryAll<ListingImageRef>(
    db,
    "SELECT id, sort_order AS sortOrder FROM listing_images WHERE listing_id = ? ORDER BY sort_order ASC, id ASC",
    [listingId],
  );
}

export async function countListingImages(db: D1Database, listingId: string): Promise<number> {
  const row = await queryFirst<{ n: number }>(db, "SELECT COUNT(*) AS n FROM listing_images WHERE listing_id = ?", [listingId]);
  return row?.n ?? 0;
}

/**
 * Registers an uploaded object. One statement checks ownership, an editable status AND the per-listing limit,
 * so two simultaneous uploads cannot exceed the limit. Returns false when any of those checks fails.
 */
export async function addListingImage(
  db: D1Database,
  input: { imageId: string; listingId: string; ownerId: string; objectKey: string; maxImages: number },
): Promise<boolean> {
  const result = await execute(
    db,
    `INSERT INTO listing_images (id, listing_id, object_key, sort_order)
     SELECT ?, l.id, ?, COALESCE((SELECT MAX(li.sort_order) + 1 FROM listing_images li WHERE li.listing_id = l.id), 0)
     FROM listings l
     WHERE ${OWNED_EDITABLE}
       AND (SELECT COUNT(*) FROM listing_images li WHERE li.listing_id = l.id) < ?`,
    [input.imageId, input.objectKey, ...ownedEditableParams(input.listingId, input.ownerId), input.maxImages],
  );
  return result.meta.changes > 0;
}

/** Removes the row (owner + editable status checked in SQL) and returns the object key that must now be deleted from R2. */
export async function removeListingImage(
  db: D1Database,
  input: { imageId: string; listingId: string; ownerId: string },
): Promise<string | null> {
  const row = await queryFirst<{ objectKey: string }>(
    db,
    `SELECT li.object_key AS objectKey FROM listing_images li JOIN listings l ON l.id = li.listing_id
     WHERE li.id = ? AND ${OWNED_EDITABLE}`,
    [input.imageId, ...ownedEditableParams(input.listingId, input.ownerId)],
  );
  if (!row) return null;
  const result = await execute(
    db,
    `DELETE FROM listing_images WHERE id = ? AND listing_id = ?
       AND EXISTS (SELECT 1 FROM listings l WHERE ${OWNED_EDITABLE})`,
    [input.imageId, input.listingId, ...ownedEditableParams(input.listingId, input.ownerId)],
  );
  return result.meta.changes > 0 ? row.objectKey : null;
}

export interface ImageForServing {
  objectKey: string;
  ownerId: string;
  listingStatus: ListingStatus;
}

export function getImageForServing(db: D1Database, imageId: string): Promise<ImageForServing | null> {
  return queryFirst<ImageForServing>(
    db,
    `SELECT li.object_key AS objectKey, l.owner_id AS ownerId, l.status AS listingStatus
     FROM listing_images li JOIN listings l ON l.id = li.listing_id WHERE li.id = ?`,
    [imageId],
  );
}
