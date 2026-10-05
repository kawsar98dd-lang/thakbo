import { data } from "react-router";
import type { Route } from "./+types/listing-edit";
import { ListingDraftForm } from "~/components/listing/ListingDraftForm";
import { PageHeader } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { ButtonLink } from "~/components/ui/Button";
import { valuesFromForm, valuesFromListing, type ListingFormActionData } from "~/lib/listing-form";
import { PATHS } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { fieldErrors, uuidParam } from "~/lib/validation/common";
import { formToObject } from "~/lib/validation/form";
import { LISTING_DRAFT_FIELDS, LISTING_DRAFT_MULTI_FIELDS, listingDraftInputSchema } from "~/lib/validation/listing";
import { cloudflareContext } from "~/server/context.server";
import { listActiveFacilities } from "~/server/db/repositories/facilities";
import { getOwnedListingDetail } from "~/server/db/repositories/listings";
import { listActiveCities } from "~/server/db/repositories/locations";
import { notFound } from "~/server/errors.server";
import { invalidFormResponse, loadLocationFormData } from "~/server/listing-form.server";
import { updateListingDraft } from "~/server/listing-service.server";
import { requireUser } from "~/server/session.server";

export const meta = () => buildMeta({ title: "Edit listing", description: "Edit your listing draft.", noindex: true });

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

  const [cities, facilities] = await Promise.all([listActiveCities(env.DB), listActiveFacilities(env.DB)]);
  const values = valuesFromListing(listing);
  return { listing: { id: listing.id, status: listing.status }, cities, facilities, values, ...(await loadLocationFormData(env.DB, values)) };
}

export async function action({ params, context, request }: Route.ActionArgs) {
  const user = requireUser(context, request);
  const id = uuidParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();
  const values = valuesFromForm(form);

  const parsed = listingDraftInputSchema.safeParse(formToObject(form, LISTING_DRAFT_FIELDS, LISTING_DRAFT_MULTI_FIELDS));
  if (!parsed.success) return invalidFormResponse(env.DB, values, fieldErrors(parsed.error));

  const result = await updateListingDraft(env.DB, user.id, id.data, parsed.data);
  if (result.ok) {
    const location = await loadLocationFormData(env.DB, values);
    return data<ListingFormActionData>({ saved: true, errors: {}, values, selectedArea: location.selectedArea, subAreas: location.subAreas });
  }
  switch (result.kind) {
    case "not_found":
      throw notFound();
    case "invalid":
      return invalidFormResponse(env.DB, values, result.errors);
    default:
      return invalidFormResponse(env.DB, values, { form: "This listing can no longer be edited here." });
  }
}

export default function EditListing({ loaderData, actionData }: Route.ComponentProps) {
  const { listing } = loaderData;
  const current = actionData ?? null;
  const isDraft = listing.status === "draft";
  return (
    <>
      <PageHeader
        title="লিস্টিং সম্পাদনা / Edit listing"
        description={isDraft ? "Changes are saved to your private draft." : "Only drafts can be edited in this version."}
        actions={<ButtonLink to={PATHS.myListings} variant="secondary">Back to my listings</ButtonLink>}
      />
      {current?.saved ? <div className="mb-4"><Alert tone="success">Draft saved.</Alert></div> : null}
      {isDraft ? null : <div className="mb-4"><Alert tone="info">This listing is not a draft, so it is shown read-only.</Alert></div>}
      <ListingDraftForm
        cities={loaderData.cities}
        facilities={loaderData.facilities}
        values={current?.values ?? loaderData.values}
        errors={current?.errors ?? {}}
        selectedArea={current ? current.selectedArea : loaderData.selectedArea}
        initialAreas={loaderData.initialAreas}
        initialSubAreas={current ? current.subAreas : loaderData.subAreas}
        submitLabel="Save draft"
        readOnly={!isDraft}
      />
    </>
  );
}
