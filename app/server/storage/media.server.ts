import { MEDIA_LIMITS } from "~/lib/constants";

/**
 * Foundation for listing images (Milestone 3 builds the upload UI on top of this).
 * Flow: browser → Worker (validates) → R2 (bytes) → D1 listing_images (object_key only).
 * R2 is reached through the MEDIA_BUCKET binding: no access keys exist or are needed.
 */

export type ImageMime = (typeof MEDIA_LIMITS.allowedMimeTypes)[number];

const EXTENSIONS: Record<ImageMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Detects the real image type from the first bytes, ignoring the (untrustworthy) browser-provided MIME type. */
export function sniffImageType(bytes: Uint8Array): ImageMime | null {
  const startsWith = (signature: number[], offset = 0) => signature.every((b, i) => bytes[offset + i] === b);
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WebP = "RIFF" .... "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** Object key layout: listings/<listingId>/<random>.<ext>. The key never contains user-provided file names. */
export function buildListingImageKey(listingId: string, mime: ImageMime, randomId: string): string {
  return `listings/${listingId}/${randomId}.${EXTENSIONS[mime]}`;
}

export type ImageValidation = { ok: true; mime: ImageMime } | { ok: false; reason: string };

export function validateImageBytes(bytes: Uint8Array): ImageValidation {
  if (bytes.byteLength === 0) return { ok: false, reason: "The file is empty." };
  if (bytes.byteLength > MEDIA_LIMITS.maxImageBytes) return { ok: false, reason: "The image is larger than 5 MB." };
  const mime = sniffImageType(bytes);
  if (!mime) return { ok: false, reason: "Only JPEG, PNG or WebP images are allowed." };
  return { ok: true, mime };
}

export async function putListingImage(bucket: R2Bucket, key: string, bytes: Uint8Array, mime: ImageMime): Promise<void> {
  await bucket.put(key, bytes, { httpMetadata: { contentType: mime } });
}

export async function deleteListingImage(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}
