import { IMAGE_EDITABLE_STATUSES, MEDIA_LIMITS, type AdminRole } from "~/lib/constants";
import { logger } from "./logger.server";
import { getAdminRole } from "./db/repositories/admin";
import {
  addListingImage,
  countListingImages,
  getImageForServing,
  removeListingImage,
  type ImageForServing,
} from "./db/repositories/images";
import { getOwnedListing } from "./db/repositories/listings";
import { buildListingImageKey, validateImageBytes, type ImageMime } from "./storage/media.server";

/**
 * Listing images: upload, delete and "who may see this image".
 * Order of operations is chosen so a failure never leaves a database row without a file:
 *   upload: validate → write R2 → insert row (if the insert fails or is refused, the file is deleted again)
 *   delete: delete row → delete file (a failed file delete only leaves an unreferenced file, which is logged)
 */

/**
 * The ONLY things this service needs from object storage: store bytes together with a content type, and delete a key.
 * It never reads the result of either call, so the contract says "any result" (`unknown`) instead of copying
 * Cloudflare's exact return types. The real `R2Bucket` binding satisfies this (checked by the compiler wherever the
 * route passes `env.MEDIA_BUCKET`), and so does a simple in-memory fake in tests. Narrowing the contract does not
 * weaken anything: the service still decides the content type itself and still removes files it cannot register.
 */
export interface ImageBucket {
  put(key: string, value: Uint8Array, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

export interface ImageDeps {
  db: D1Database;
  bucket: ImageBucket;
  newId?: () => string;
}

export type UploadResult =
  | { ok: true; imageId: string }
  | { ok: false; kind: "not_found" | "not_editable" | "limit" | "invalid_file" | "conflict" | "storage_error"; message: string };

const MESSAGES = {
  not_found: "This listing could not be found.",
  not_editable: "Photos can only be changed while the listing is a draft or was rejected. Move it back to draft first.",
  limit: `A listing can have at most ${MEDIA_LIMITS.maxImagesPerListing} photos.`,
  conflict: "The photo could not be added because the listing changed. Please refresh and try again.",
  storage_error: "The photo could not be saved right now. Please try again in a moment.",
} as const;

export async function uploadListingImage(
  deps: ImageDeps,
  ownerId: string,
  listingId: string,
  bytes: Uint8Array,
): Promise<UploadResult> {
  const listing = await getOwnedListing(deps.db, listingId, ownerId);
  if (!listing) return { ok: false, kind: "not_found", message: MESSAGES.not_found };
  if (!IMAGE_EDITABLE_STATUSES.includes(listing.status)) return { ok: false, kind: "not_editable", message: MESSAGES.not_editable };
  if ((await countListingImages(deps.db, listingId)) >= MEDIA_LIMITS.maxImagesPerListing) {
    return { ok: false, kind: "limit", message: MESSAGES.limit };
  }

  // The real type comes from the file's own bytes, never from its name or the browser's Content-Type.
  const checked = validateImageBytes(bytes);
  if (!checked.ok) return { ok: false, kind: "invalid_file", message: checked.reason };

  const newId = deps.newId ?? (() => crypto.randomUUID());
  const imageId = newId();
  const objectKey = buildListingImageKey(listingId, checked.mime as ImageMime, newId());

  try {
    await deps.bucket.put(objectKey, bytes, { httpMetadata: { contentType: checked.mime } });
  } catch (error) {
    logger.error("image upload to storage failed", { error });
    return { ok: false, kind: "storage_error", message: MESSAGES.storage_error };
  }

  let registered = false;
  try {
    registered = await addListingImage(deps.db, { imageId, listingId, ownerId, objectKey, maxImages: MEDIA_LIMITS.maxImagesPerListing });
  } catch (error) {
    logger.error("image row could not be saved", { error });
    await discardObject(deps.bucket, objectKey);
    return { ok: false, kind: "storage_error", message: MESSAGES.storage_error };
  }
  if (!registered) {
    await discardObject(deps.bucket, objectKey);
    return { ok: false, kind: "conflict", message: MESSAGES.conflict };
  }
  return { ok: true, imageId };
}

async function discardObject(bucket: Pick<ImageBucket, "delete">, key: string): Promise<void> {
  try {
    await bucket.delete(key);
  } catch (error) {
    logger.warn("could not remove an unreferenced image file", { objectKey: key, error });
  }
}

export type RemoveResult = { ok: true } | { ok: false; kind: "not_found" | "not_editable"; message: string };

export async function removeImage(deps: ImageDeps, ownerId: string, listingId: string, imageId: string): Promise<RemoveResult> {
  const listing = await getOwnedListing(deps.db, listingId, ownerId);
  if (!listing) return { ok: false, kind: "not_found", message: MESSAGES.not_found };
  if (!IMAGE_EDITABLE_STATUSES.includes(listing.status)) return { ok: false, kind: "not_editable", message: MESSAGES.not_editable };
  const key = await removeListingImage(deps.db, { imageId, listingId, ownerId });
  if (key === null) return { ok: false, kind: "not_found", message: "This photo could not be found." };
  await discardObject(deps.bucket, key);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------------------------
// Who may see an image
// ---------------------------------------------------------------------------------------------------------------

export type ImageAccess = "public" | "private" | "deny";

/** Statuses whose images moderators may open (drafts stay private to the owner; deleted listings are gone). */
const MODERATOR_VISIBLE = ["pending", "published", "paused", "rejected"];

/**
 *  - published listing        → anyone (public, cacheable for a short time)
 *  - own listing (not deleted) → the owner only (private, never cached)
 *  - pending/paused/rejected   → registered admins/moderators too
 *  - anything else             → deny (the route answers 404, never 403, so nothing can be probed)
 */
export async function resolveImageAccess(db: D1Database, image: ImageForServing, viewerId: string | null): Promise<ImageAccess> {
  if (image.listingStatus === "deleted") return "deny";
  if (image.listingStatus === "published") return "public";
  if (viewerId === null) return "deny";
  if (viewerId === image.ownerId) return "private";
  if (MODERATOR_VISIBLE.includes(image.listingStatus)) {
    const role: AdminRole | null = await getAdminRole(db, viewerId);
    if (role !== null) return "private";
  }
  return "deny";
}

export { getImageForServing };
