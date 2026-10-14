import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { MEDIA_LIMITS } from "~/lib/constants";
import { listingImagePath, listingImagesActionPath } from "~/lib/routes";
import type { ImageActionData } from "~/routes/dashboard/listing-images";

interface ImageManagerProps {
  listingId: string;
  images: Array<{ id: string }>;
  /** False while the listing is live or under review: photos are then shown but cannot be changed. */
  editable: boolean;
  error?: string;
}

function DeleteButton({ listingId, imageId }: { listingId: string; imageId: string }) {
  const fetcher = useFetcher<ImageActionData>();
  return (
    <fetcher.Form method="post" action={listingImagesActionPath(listingId)}>
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="imageId" value={imageId} />
      <Button type="submit" variant="ghost" loading={fetcher.state !== "idle"} aria-label="Remove this photo">
        Remove
      </Button>
    </fetcher.Form>
  );
}

function MoveButton({
  listingId,
  imageId,
  direction,
  disabled,
}: {
  listingId: string;
  imageId: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  const fetcher = useFetcher<ImageActionData>();
  const intent = direction === "up" ? "move_up" : "move_down";
  const label = direction === "up" ? "Move photo up" : "Move photo down";
  return (
    <fetcher.Form method="post" action={listingImagesActionPath(listingId)}>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="imageId" value={imageId} />
      <Button type="submit" variant="ghost" loading={fetcher.state !== "idle"} disabled={disabled || fetcher.state !== "idle"} aria-label={label}>
        {direction === "up" ? "Move up" : "Move down"}
      </Button>
      {fetcher.data ? (
        <span className={fetcher.data.ok ? "sr-only" : "block text-xs text-red-700"} role={fetcher.data.ok ? "status" : "alert"}>
          {fetcher.data.message}
        </span>
      ) : null}
    </fetcher.Form>
  );
}

/** Photos of one listing. Separate from the main form (forms cannot be nested); each action re-checks ownership on the server. */
export function ImageManager({ listingId, images, editable, error }: ImageManagerProps) {
  const fetcher = useFetcher<ImageActionData>();
  const input = useRef<HTMLInputElement>(null);
  const uploading = fetcher.state !== "idle";
  const full = images.length >= MEDIA_LIMITS.maxImagesPerListing;

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok && input.current) input.current.value = "";
  }, [fetcher.state, fetcher.data]);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="photos-heading">
      <div>
        <h2 id="photos-heading" className="text-lg font-bold">
          ছবি / Photos ({images.length} of {MEDIA_LIMITS.maxImagesPerListing})
        </h2>
        <p className="text-sm text-slate-600">At least one photo is needed to submit. JPEG, PNG or WebP, up to 5 MB each.</p>
      </div>

      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <li key={image.id} className="space-y-1">
              <img src={listingImagePath(image.id)} alt={`Listing photo ${index + 1}`} loading="lazy" className="aspect-[4/3] w-full rounded-lg border border-slate-200 object-cover" />
              {editable ? (
                <div className="flex flex-wrap items-center gap-1">
                  <MoveButton listingId={listingId} imageId={image.id} direction="up" disabled={index === 0} />
                  <MoveButton listingId={listingId} imageId={image.id} direction="down" disabled={index === images.length - 1} />
                  <DeleteButton listingId={listingId} imageId={image.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-700">No photos yet.</p>
      )}

      {editable ? (
        <fetcher.Form method="post" action={listingImagesActionPath(listingId)} encType="multipart/form-data" className="space-y-3">
          <label htmlFor="photo-file" className="block text-sm font-medium text-slate-800">
            Add a photo
          </label>
          <input ref={input} id="photo-file" name="image" type="file" accept="image/jpeg,image/png,image/webp" disabled={full || uploading} className="block w-full text-sm" />
          <Button type="submit" variant="secondary" loading={uploading} disabled={full}>
            {uploading ? "Uploading…" : "Upload photo"}
          </Button>
        </fetcher.Form>
      ) : (
        <Alert tone="info">Photos can only be changed while the listing is a draft or was rejected.</Alert>
      )}

      {fetcher.data ? <Alert tone={fetcher.data.ok ? "success" : "error"}>{fetcher.data.message}</Alert> : null}
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
    </section>
  );
}
