import { data } from "react-router";
import type { Route } from "./+types/listing-images";
import { MEDIA_LIMITS } from "~/lib/constants";
import { uuidParam } from "~/lib/validation/common";
import { cloudflareContext } from "~/server/context.server";
import { notFound } from "~/server/errors.server";
import { removeImage, uploadListingImage } from "~/server/image-service.server";
import { requireUser } from "~/server/session.server";

export interface ImageActionData {
  ok: boolean;
  message: string;
}

/** Slack for the multipart envelope around a 5 MB file. */
const MAX_BODY_BYTES = MEDIA_LIMITS.maxImageBytes + 256 * 1024;

const STATUS_BY_KIND = {
  not_found: 404,
  not_editable: 409,
  limit: 409,
  conflict: 409,
  invalid_file: 400,
  storage_error: 503,
} as const;

/**
 * Photo upload and delete for ONE listing. The owner is the signed-in user (never read from the form), and the
 * service re-checks ownership and an editable status. The browser's file name and Content-Type are ignored:
 * the type is read from the file's own bytes and the storage key is random.
 */
export async function action({ params, context, request }: Route.ActionArgs) {
  const user = requireUser(context, request);
  const listingId = uuidParam.safeParse(params.id);
  if (!listingId.success) throw notFound();
  const { env } = context.get(cloudflareContext);

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return data<ImageActionData>({ ok: false, message: "The image is larger than 5 MB." }, { status: 413 });
  }

  const form = await request.formData();
  const deps = { db: env.DB, bucket: env.MEDIA_BUCKET };

  if (form.get("intent") === "delete") {
    const imageId = uuidParam.safeParse(form.get("imageId"));
    if (!imageId.success) return data<ImageActionData>({ ok: false, message: "This photo could not be found." }, { status: 404 });
    const removed = await removeImage(deps, user.id, listingId.data, imageId.data);
    if (!removed.ok) return data<ImageActionData>({ ok: false, message: removed.message }, { status: removed.kind === "not_found" ? 404 : 409 });
    return data<ImageActionData>({ ok: true, message: "Photo removed." });
  }

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return data<ImageActionData>({ ok: false, message: "Choose a photo to upload." }, { status: 400 });
  }
  if (file.size > MEDIA_LIMITS.maxImageBytes) {
    return data<ImageActionData>({ ok: false, message: "The image is larger than 5 MB." }, { status: 413 });
  }

  const result = await uploadListingImage(deps, user.id, listingId.data, new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return data<ImageActionData>({ ok: false, message: result.message }, { status: STATUS_BY_KIND[result.kind] });
  return data<ImageActionData>({ ok: true, message: "Photo added." });
}
