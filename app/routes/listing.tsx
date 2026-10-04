import type { Route } from "./+types/listing";
import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { Badge } from "~/components/ui/Badge";
import { Card } from "~/components/ui/Card";
import { AVAILABILITY_LABELS, PROPERTY_TYPE_LABELS } from "~/lib/constants";
import { estimateMonthlyCost, formatTaka } from "~/lib/cost";
import { buildMeta } from "~/lib/seo";
import { slugParam } from "~/lib/validation/common";
import { cloudflareContext } from "~/server/context.server";
import { getPublishedListingBySlug } from "~/server/db/repositories/listings";
import { notFound } from "~/server/errors.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const slug = slugParam.safeParse(params.slug);
  if (!slug.success) throw notFound();
  const listing = await getPublishedListingBySlug(context.get(cloudflareContext).env.DB, slug.data);
  if (!listing) throw notFound();
  return { listing };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return buildMeta({ title: "Listing not found", description: "This listing is not available.", noindex: true });
  const { listing } = loaderData;
  return buildMeta({
    title: listing.title,
    description: `${PROPERTY_TYPE_LABELS[listing.propertyType]} in ${listing.areaName}, ${listing.cityName}.`,
  });
}

/** Foundation only: the full detail page (gallery, map, contact, report) is Milestone 5. */
export default function ListingPage({ loaderData }: Route.ComponentProps) {
  const { listing } = loaderData;
  const monthly = estimateMonthlyCost(listing);
  return (
    <PageContainer>
      <PageHeader title={listing.title} description={`${listing.areaName}, ${listing.cityName}`} />
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{PROPERTY_TYPE_LABELS[listing.propertyType]}</Badge>
          <Badge>{AVAILABILITY_LABELS[listing.availabilityStatus]}</Badge>
        </div>
        <p className="text-2xl font-bold text-brand-800">{formatTaka(listing.rentAmount)} / month</p>
        {monthly !== null ? <p className="text-sm text-slate-600">Estimated total: {formatTaka(monthly)} / month</p> : null}
        {listing.description ? <p className="whitespace-pre-line text-slate-700">{listing.description}</p> : null}
      </Card>
    </PageContainer>
  );
}
