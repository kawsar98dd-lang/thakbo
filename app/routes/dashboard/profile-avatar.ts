import type { Route } from "./+types/profile-avatar";
import { cloudflareContext } from "~/server/context.server";
import { ensureProfile, getProfile, updateAvatarKey } from "~/server/db/repositories/profiles";
import { requireUser } from "~/server/session.server";
import { logger } from "~/server/logger.server";
import { validateImageBytes, type ImageMime } from "~/server/storage/media.server";
import { redirect } from "react-router";

const MAX_BODY_BYTES = 5 * 1024 * 1024 + 256 * 1024;
const AVATAR_KEY = /^avatars\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const MIME_BY_EXTENSION: Record<string, ImageMime> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const EXTENSION_BY_MIME: Record<ImageMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const noPhoto = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" } });

/** Private avatar endpoint: only the signed-in account can read or change its own photo. */
export async function loader({ context, request }: Route.LoaderArgs) {
  const user = requireUser(context, request);
  const { env } = context.get(cloudflareContext);
  await ensureProfile(env.DB, user.id, user.name);
  const profile = await getProfile(env.DB, user.id);
  const key = profile?.avatarUrl;
  if (!key || !AVATAR_KEY.test(key)) return noPhoto();
  try {
    const object = await env.MEDIA_BUCKET.get(key);
    if (!object) return noPhoto();
    const ext = key.split(".").pop() ?? "";
    return new Response(object.body, { headers: {
      "Content-Type": MIME_BY_EXTENSION[ext],
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
      ETag: object.httpEtag,
    }});
  } catch (error) {
    logger.error("profile avatar read failed", { error });
    return new Response("Image temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function action({ context, request }: Route.ActionArgs) {
  const user = requireUser(context, request);
  const { env } = context.get(cloudflareContext);
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    throw new Response("The image is larger than 5 MB.", { status: 413 });
  }
  await ensureProfile(env.DB, user.id, user.name);
  const profile = await getProfile(env.DB, user.id);
  const oldKey = profile?.avatarUrl ?? null;
  const form = await request.formData();

  if (form.get("intent") === "delete") {
    if (oldKey && AVATAR_KEY.test(oldKey)) {
      await updateAvatarKey(env.DB, user.id, null);
      try { await env.MEDIA_BUCKET.delete(oldKey); } catch (error) { logger.warn("old profile avatar cleanup failed", { error }); }
    }
    return redirect("/dashboard/profile");
  }

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) throw new Response("Choose a photo to upload.", { status: 400 });
  if (file.size > 5 * 1024 * 1024) throw new Response("The image is larger than 5 MB.", { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validateImageBytes(bytes);
  if (!checked.ok) throw new Response(checked.reason, { status: 400 });

  const key = `avatars/${crypto.randomUUID()}.${EXTENSION_BY_MIME[checked.mime]}`;
  try {
    await env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType: checked.mime } });
  } catch (error) {
    logger.error("profile avatar upload failed", { error });
    throw new Response("Photo could not be uploaded right now. Please try again.", { status: 503 });
  }

  try {
    const updated = await updateAvatarKey(env.DB, user.id, key);
    if (!updated) throw new Error("Profile row was not updated");
  } catch (error) {
    try { await env.MEDIA_BUCKET.delete(key); } catch (cleanupError) { logger.warn("orphan avatar cleanup failed", { cleanupError }); }
    logger.error("profile avatar database update failed", { error });
    throw new Response("Photo could not be saved. Please try again.", { status: 503 });
  }

  if (oldKey && AVATAR_KEY.test(oldKey) && oldKey !== key) {
    try { await env.MEDIA_BUCKET.delete(oldKey); } catch (error) { logger.warn("old profile avatar cleanup failed", { error }); }
  }
  return redirect("/dashboard/profile");
}
