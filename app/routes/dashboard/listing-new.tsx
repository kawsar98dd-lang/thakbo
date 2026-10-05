import { redirect } from "react-router";
import type { Route } from "./+types/listing-new";
import { ListingDraftForm } from "~/components/listing/ListingDraftForm";
import { PageHeader } from "~/components/layout/PageContainer";
import { EMPTY_LISTING_FORM, valuesFromForm } from "~/lib/listing-form";
import { PATHS } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { fieldErrors } from "~/lib/validation/common";
import { formToObject } from "~/lib/validation/form";
import { LISTING_DRAFT_FIELDS, LISTING_DRAFT_MULTI_FIELDS, listingDraftInputSchema } from "~/lib/validation/listing";
import { cloudflareContext } from "~/server/context.server";
import { listActiveFacilities } from "~/server/db/repositories/facilities";
import { listActiveCities } from "~/server/db/repositories/locations";
import { getProfile } from "~/server/db/repositories/profiles";
import { invalidFormResponse, loadLocationFormData } from "~/server/listing-form.server";
import { createListingDraft } from "~/server/listing-service.server";
import { requireUser } from "~/server/session.server";

export const meta = () => buildMeta({ title: "New listing", description: "Start a new listing draft.", noindex: true });

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = requireUser(context, request);
  const { env } = context.get(cloudflareContext);
  const [cities, facilities, profile] = await Promise.all([listActiveCities(env.DB), listActiveFacilities(env.DB), getProfile(env.DB, user.id)]);

  // Pre-select the user's preferred city, or the only city that exists.
  const preselected = cities.find((city) => city.id === profile?.preferredCityId) ?? (cities.length === 1 ? cities[0] : undefined);
  const values = { ...EMPTY_LISTING_FORM, cityId: preselected ? String(preselected.id) : "" };
  return { cities, facilities, values, ...(await loadLocationFormData(env.DB, values)) };
}

/** The owner is the session user. Nothing about ownership, status or slug is read from the form. */
export async function action({ context, request }: Route.ActionArgs) {
  const user = requireUser(context, request);
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();
  const values = valuesFromForm(form);

  const parsed = listingDraftInputSchema.safeParse(formToObject(form, LISTING_DRAFT_FIELDS, LISTING_DRAFT_MULTI_FIELDS));
  if (!parsed.success) return invalidFormResponse(env.DB, values, fieldErrors(parsed.error));

  const result = await createListingDraft(env.DB, user.id, parsed.data);
  if (!result.ok) {
    const errors = result.kind === "invalid" ? result.errors : { form: "Your draft could not be saved. Please try again." };
    return invalidFormResponse(env.DB, values, errors);
  }
  return redirect(PATHS.myListings);
}

export default function NewListing({ loaderData, actionData }: Route.ComponentProps) {
  const failed = actionData && !actionData.saved ? actionData : null;
  return (
    <>
      <PageHeader title="নতুন লিস্টিং / New listing" description="Fill in what you know. You can save an incomplete draft and finish it later." />
      <ListingDraftForm
        cities={loaderData.cities}
        facilities={loaderData.facilities}
        values={failed?.values ?? loaderData.values}
        errors={failed?.errors ?? {}}
        selectedArea={failed ? failed.selectedArea : loaderData.selectedArea}
        initialAreas={loaderData.initialAreas}
        initialSubAreas={failed ? failed.subAreas : loaderData.subAreas}
        submitLabel="Save draft"
      />
    </>
  );
}
