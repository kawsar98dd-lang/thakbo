import type { Route } from "./+types/images";
import { uuidParam } from "~/lib/validation/common";
import { cloudflareContext, currentUserContext } from "~/server/context.server";
import { getImageForServing, resolveImageAccess } from "~/server/image-service.server";
import { logger } from "~/server/logger.server";
import { mimeFromKey } from "~/server/storage/media.server";

/**
 * Serves a listing photo from the PRIVATE R2 bucket (the bucket itself is never public).
 *  - image of a published listing → anyone, cached briefly;
 *  - otherwise only the owner (or an admin/moderator for listings under review) → private, never cached;
 *  - everything else answers 404, so nobody can tell whether an image id exists.
 * The URL contains an opaque image id, never the storage key or the listing id.
 */
const NOT_FOUND = () =>
  new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });

export async function loader({ params, context, request }: Route.LoaderArgs) {
  const imageId = uuidParam.safeParse(params.imageId);
  if (!imageId.success) return NOT_FOUND();
  const { env } = context.get(cloudflareContext);
  const viewer = context.get(currentUserContext);

  const image = await getImageForServing(env.DB, imageId.data);
  if (!image) return NOT_FOUND();
  const access = await resolveImageAccess(env.DB, image, viewer?.id ?? null);
  if (access === "deny") return NOT_FOUND();

  const contentType = mimeFromKey(image.objectKey);
  if (contentType === null) return NOT_FOUND();

  let object: R2ObjectBody | null;
  try {
    object = await env.MEDIA_BUCKET.get(image.objectKey);
  } catch (error) {
    logger.error("image read from storage failed", { error });
    return new Response("Image temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (!object) return NOT_FOUND();

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-site",
    Vary: "Cookie",
    ETag: object.httpEtag,
  });
  if (access === "public") {
    headers.set("Cache-Control", "public, max-age=300");
    if (request.headers.get("if-none-match") === object.httpEtag) return new Response(null, { status: 304, headers });
  } else {
    headers.set("Cache-Control", "private, no-store");
  }
  return new Response(object.body, { status: 200, headers });
}
