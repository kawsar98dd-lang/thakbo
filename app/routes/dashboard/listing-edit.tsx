import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/listing-edit";
import { ImageManager } from "~/components/listing/ImageManager";
import { ListingDraftForm } from "~/components/listing/ListingDraftForm";
import { PageHeader } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Badge } from "~/components/ui/Badge";
import { Button, ButtonLink } from "~/components/ui/Button";
import { IMAGE_EDITABLE_STATUSES, LISTING_STATUS_LABELS, type ListingStatus } from "~/lib/constants";
import { valuesFromListing, type ListingFormActionData } from "~/lib/listing-form";
import { PATHS } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { fieldErrors, uuidParam } from "~/lib/validation/common";
import { listingDraftInputSchema } from "~/lib/validation/listing";
import { cloudflareContext } from "~/server/context.server";
import { listActiveFacilities } from "~/server/db/repositories/facilities";
import { listListingImages } from "~/server/db/repositories/images";
import { getOwnedListingDetail } from "~/server/db/repositories/listings";
import { listActiveCities } from "~/server/db/repositories/locations";
import { notFound } from "~/server/errors.server";
import { invalidFormResponse, loadLocationFormData, readListingForm } from "~/server/listing-form.server";
import { moveListingToDraft, submitListing, updateListing } from "~/server/listing-service.server";
import { requireUser } from "~/server/session.server";

export const meta = () => buildMeta({ title: "Edit listing", description: "Edit your listing.", noindex: true });

/**
 * Owner authorization (blueprint §19): the owner id comes from the verified session, never from the URL or form.
 * Someone else's listing looks exactly like a missing one (404), so ids cannot be probed.
 */
export async function loader({ params, context, request }: Route.LoaderArgs) {
  const user = requireUser(context, request);
  const id = uuidParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const { env } = context.get(cloudflareContext);

  const listing = await getOwnedListingDetail(env.DB, id.data, user.id);
  if (!listing) throw notFound();

  const [cities, facilities, images] = await Promise.all([listActiveCities(env.DB), listActiveFacilities(env.DB), listListingImages(env.DB, id.data)]);
  const values = valuesFromListing(listing);
  return {
    listing: { id: listing.id, status: listing.status, rejectionReason: listing.rejectionReason },
    images: images.map((image) => ({ id: image.id })),
    cities,
    facilities,
    values,
    ...(await loadLocationFormData(env.DB, values)),
  };
}

export async function action({ params, context, request }: Route.ActionArgs) {
  const user = requireUser(context, request);
  const id = uuidParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();
  const intent = form.get("intent");

  // Moving a listing back to draft (withdraw from review / take offline). Status rules are enforced in the service.
  if (intent === "to_draft") {
    const moved = await moveListingToDraft(env.DB, user.id, id.data);
    if (!moved.ok) {
      if (moved.kind === "not_found") throw notFound();
      return data({ tone: "error" as const, message: "This listing cannot be moved back to draft right now." }, { status: 409 });
    }
    return redirect(request.url);
  }

  const { values, raw, locationError } = readListingForm(form);
  const parsed = listingDraftInputSchema.safeParse(raw);
  if (!parsed.success || locationError) {
    const errors = parsed.success ? {} : fieldErrors(parsed.error);
    return invalidFormResponse(env.DB, values, locationError ? { ...errors, location: locationError } : errors);
  }

  const result = await updateListing(env.DB, user.id, id.data, parsed.data);
  if (!result.ok) {
    switch (result.kind) {
      case "not_found":
        throw notFound();
      case "invalid":
        return invalidFormResponse(env.DB, values, result.errors);
      default:
        return invalidFormResponse(env.DB, values, { form: "This listing can no longer be edited here. Refresh the page." });
    }
  }

  // A live listing that was edited is already back in review (it left public search in the same database statement).
  if (result.wentOffline) return redirect(`${PATHS.myListings}?notice=resubmitted`);

  if (intent === "submit") {
    const submitted = await submitListing(env.DB, user.id, id.data);
    if (submitted.ok) return redirect(`${PATHS.myListings}?notice=submitted`);
    if (submitted.kind === "invalid") {
      return invalidFormResponse(env.DB, values, { form: "Your changes were saved, but the listing cannot be submitted yet.", ...submitted.errors });
    }
    if (submitted.kind === "not_found") throw notFound();
    return invalidFormResponse(env.DB, values, { form: "Your changes were saved, but the listing could not be submitted. Refresh the page." });
  }

  const location = await loadLocationFormData(env.DB, values);
  return data<ListingFormActionData>({ saved: true, errors: {}, values, selectedArea: location.selectedArea, subAreas: location.subAreas });
}

const STATUS_TONE: Record<ListingStatus, "neutral" | "brand" | "warning" | "danger"> = {
  draft: "warning",
  pending: "warning",
  published: "brand",
  paused: "neutral",
  rejected: "danger",
  deleted: "neutral",
};

function formActions(status: ListingStatus) {
  if (status === "published" || status === "paused") {
    return {
      actions: [{ intent: "save", label: "Save and send for review", pendingText: "Saving…" }],
      saveNote: "Saving takes this listing OFFLINE until a moderator approves it again. Complete information, a contact number and a photo are required.",
    };
  }
  if (status === "rejected") {
    return {
      actions: [
        { intent: "save", label: "Save changes", pendingText: "Saving…", variant: "secondary" as const },
        { intent: "submit", label: "Save and resubmit", pendingText: "Submitting…" },
      ],
      saveNote: "Fix the points in the moderator's note, then resubmit the listing for review.",
    };
  }
  return {
    actions: [
      { intent: "save", label: "Save draft", pendingText: "Saving…", variant: "secondary" as const },
      { intent: "submit", label: "Save and submit for review", pendingText: "Submitting…" },
    ],
    saveNote: "A draft is private. Submit it when it is complete: a moderator checks it before it goes live.",
  };
}

export default function EditListing({ loaderData, actionData }: Route.ComponentProps) {
  const { listing } = loaderData;
  const result = actionData && "values" in actionData ? (actionData as ListingFormActionData) : null;
  const toDraftError = actionData && "message" in actionData ? actionData : null;
  const locked = listing.status === "pending";
  const canMoveToDraft = listing.status === "pending" || listing.status === "published" || listing.status === "paused" || listing.status === "rejected";
  const { actions, saveNote } = formActions(listing.status);

  return (
    <>
      <PageHeader
        title="লিস্টিং সম্পাদনা / Edit listing"
        description="Changes to a live listing take it offline until a moderator approves it again."
        actions={<ButtonLink to={PATHS.myListings} variant="secondary">Back to my listings</ButtonLink>}
      />
      <div className="mb-4 space-y-3">
        <Badge tone={STATUS_TONE[listing.status]}>{LISTING_STATUS_LABELS[listing.status]}</Badge>
        {listing.status === "rejected" && listing.rejectionReason ? (
          <Alert tone="error" title="A moderator asked for changes">
            <span className="whitespace-pre-line">{listing.rejectionReason}</span>
          </Alert>
        ) : null}
        {locked ? <Alert tone="info">This listing is waiting for review and cannot be edited. Move it back to draft if you need to change it.</Alert> : null}
        {result?.saved ? <Alert tone="success">Changes saved.</Alert> : null}
        {toDraftError ? <Alert tone="error">{toDraftError.message}</Alert> : null}
        {canMoveToDraft ? (
          <Form method="post">
            <input type="hidden" name="intent" value="to_draft" />
            <Button type="submit" variant="secondary">
              {listing.status === "pending" ? "Withdraw from review (back to draft)" : listing.status === "rejected" ? "Move back to draft" : "Take offline and move to draft"}
            </Button>
          </Form>
        ) : null}
      </div>

      <div className="space-y-6">
        <ImageManager listingId={listing.id} images={loaderData.images} editable={IMAGE_EDITABLE_STATUSES.includes(listing.status)} />
        <ListingDraftForm
          cities={loaderData.cities}
          facilities={loaderData.facilities}
          values={result?.values ?? loaderData.values}
          errors={result?.errors ?? {}}
          selectedArea={result ? result.selectedArea : loaderData.selectedArea}
          initialAreas={loaderData.initialAreas}
          initialSubAreas={result ? result.subAreas : loaderData.subAreas}
          actions={actions}
          saveNote={saveNote}
          readOnly={locked}
        />
      </div>
    </>
  );
}
