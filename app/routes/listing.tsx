import { data, Form, Link, redirect } from "react-router";
import type { Route } from "./+types/listing";
import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Breadcrumbs } from "~/components/seo/Breadcrumbs";
import { ShareListingButton } from "~/components/listing/ShareListingButton";
import { Alert } from "~/components/ui/Alert";
import { AVAILABILITY_LABELS, AUDIENCE_LABELS, PROPERTY_TYPE_LABELS, REPORT_REASONS, SITE, type ReportReason } from "~/lib/constants";
import { estimateMonthlyCost, formatTaka } from "~/lib/cost";
import { normalizeContactNumber } from "~/lib/contact";
import { areaPath, cityPath, listingImagePath, PATHS } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { slugParam } from "~/lib/validation/common";
import { cloudflareContext, currentUserContext } from "~/server/context.server";
import { getPublishedListingBySlug } from "~/server/db/repositories/listings";
import { getPublicListingExtras, isListingFavorite, isPublishedListingOwner, submitListingReport, toggleListingFavorite } from "~/server/db/repositories/engagement";
import { notFound } from "~/server/errors.server";
import { requireUser } from "~/server/session.server";

const REPORT_LABELS: Record<ReportReason, string> = {
  fake_listing: "Fake listing", wrong_information: "Incorrect information", already_rented: "Already rented",
  inappropriate_content: "Inappropriate content", spam: "Spam", duplicate: "Duplicate listing", other: "Other",
};

export async function loader({ params, context }: Route.LoaderArgs) {
  const slug = slugParam.safeParse(params.slug);
  if (!slug.success) throw notFound();
  const { env } = context.get(cloudflareContext);
  const listing = await getPublishedListingBySlug(env.DB, slug.data);
  if (!listing) throw notFound();
  const [extras, user] = await Promise.all([
    getPublicListingExtras(env.DB, slug.data),
    Promise.resolve(context.get(currentUserContext)),
  ]);
  const [favorite, isOwner] = user
    ? await Promise.all([
        isListingFavorite(env.DB, user.id, slug.data),
        isPublishedListingOwner(env.DB, user.id, slug.data),
      ])
    : [false, false];
  return { listing, extras, signedIn: Boolean(user), favorite, isOwner };
}

export async function action({ params, context, request }: Route.ActionArgs) {
  const slug = slugParam.safeParse(params.slug);
  if (!slug.success) throw notFound();
  const user = requireUser(context, request);
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "favorite") {
    await toggleListingFavorite(env.DB, user.id, slug.data);
    return redirect(`/listing/${encodeURIComponent(slug.data)}`);
  }
  if (intent === "report") {
    const rawReason = form.get("reason");
    const rawDetails = form.get("details");
    const reason = typeof rawReason === "string" && (REPORT_REASONS as readonly string[]).includes(rawReason) ? rawReason as ReportReason : null;
    const details = typeof rawDetails === "string" ? rawDetails.trim() : "";
    if (!reason || details.length > 1000) {
      return data({ report: "error" as const, message: "Choose a report reason and keep details under 1,000 characters." }, { status: 400 });
    }
    const submitted = await submitListingReport(env.DB, {
      id: crypto.randomUUID(), slug: slug.data, reporterId: user.id, reason, details: details || null,
    });
    if (!submitted) return data({ report: "error" as const, message: "This report could not be submitted. You may own this listing, already have a report waiting for review, or have reached the limit of 10 reports per 24 hours." }, { status: 409 });
    return data({ report: "success" as const, message: "Thank you. Your report has been sent to the moderation team." });
  }
  return data({ report: "error" as const, message: "Unknown action." }, { status: 400 });
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return buildMeta({ title: "Listing not found", description: "This listing is not available.", noindex: true });
  const { listing } = loaderData;
  const image = listing.coverImageId ? `${SITE.canonicalOrigin}${listingImagePath(listing.coverImageId)}` : undefined;
  return buildMeta({
    title: listing.title,
    description: `${PROPERTY_TYPE_LABELS[listing.propertyType]} in ${listing.areaName}, ${listing.cityName}. Monthly rent: ${formatTaka(listing.rentAmount)}. ${AVAILABILITY_LABELS[listing.availabilityStatus]}.`,
    image,
    imageAlt: image ? `Photo of ${listing.title}` : undefined,
  });
}

export default function ListingPage({ loaderData, actionData }: Route.ComponentProps) {
  const { listing, extras, signedIn, favorite, isOwner } = loaderData;
  const monthly = estimateMonthlyCost(listing);
  const phone = normalizeContactNumber(extras.phone);
  const whatsapp = normalizeContactNumber(extras.whatsapp);
  const mapSearch = encodeURIComponent([extras.landmark, listing.areaName, listing.cityName].filter(Boolean).join(", "));
  const reportSuccess = actionData && "report" in actionData && actionData.report === "success";
  const reportError = actionData && "report" in actionData && actionData.report === "error";
  return (
    <PageContainer>
      <Breadcrumbs items={[
        { label: "Home", path: "/" },
        { label: listing.cityName, path: cityPath(listing.citySlug) },
        { label: listing.areaName, path: areaPath(listing.citySlug, listing.areaSlug) },
        { label: listing.title },
      ]} />
      <PageHeader title={listing.title} description={`${listing.areaName}, ${listing.cityName}`} actions={
        <div className="flex flex-wrap items-start gap-2">
          <ShareListingButton title={listing.title} />
          {signedIn && isOwner ? (
            <span className="inline-flex min-h-11 items-center rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-600">Your listing</span>
          ) : signedIn ? (
            <Form method="post"><input type="hidden" name="intent" value="favorite" />
              <Button type="submit" variant={favorite ? "secondary" : "primary"}>{favorite ? "♥ Saved" : "♡ Save place"}</Button>
            </Form>
          ) : (
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-semibold text-brand-800 underline" to={`${PATHS.login}?redirectTo=${encodeURIComponent(`/listing/${listing.slug}`)}`}>Sign in to save</Link>
          )}
        </div>
      } />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-5">
          <Card className="space-y-4">
            {extras.images.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {extras.images.map((photo, index) => <a key={photo.id} href={listingImagePath(photo.id)} target="_blank" rel="noreferrer" className={index === 0 ? "col-span-2 sm:col-span-2" : ""}>
                <img src={listingImagePath(photo.id)} alt={photo.altText || `${listing.title} photo ${index + 1}`} loading={index > 1 ? "lazy" : "eager"} decoding="async" fetchPriority={index === 0 ? "high" : "auto"} className={`w-full rounded-lg bg-slate-100 object-cover ${index === 0 ? "aspect-[16/10]" : "aspect-[4/3]"}`} />
              </a>)}
            </div> : <div className="flex aspect-[16/7] items-center justify-center rounded-lg bg-slate-100 text-slate-500">No photos added yet</div>}
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">{PROPERTY_TYPE_LABELS[listing.propertyType]}</Badge>
              <Badge tone={listing.availabilityStatus === "available" || listing.availabilityStatus === "available_from" ? "neutral" : "warning"}>{AVAILABILITY_LABELS[listing.availabilityStatus]}</Badge>
            </div>
            <p className="text-2xl font-bold text-brand-800">{formatTaka(listing.rentAmount)} <span className="text-sm font-normal text-slate-600">/ month</span></p>
            {monthly !== null ? <p className="text-sm text-slate-600">Estimated monthly total: <strong>{formatTaka(monthly)}</strong></p> : null}
            {listing.advanceAmount !== null ? <p className="text-sm text-slate-600">Advance / deposit: {formatTaka(listing.advanceAmount)}</p> : null}
            {listing.availableFrom ? <p className="text-sm text-slate-600">Available from: {listing.availableFrom}</p> : null}
            {listing.description ? <div><h2 className="mb-2 text-lg font-semibold">About this place</h2><p className="whitespace-pre-line text-slate-700">{listing.description}</p></div> : null}
          </Card>
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">Location</h2>
            <p className="text-slate-700">{listing.areaName}, {listing.cityName}</p>
            {extras.landmark ? <p className="text-sm text-slate-600">Nearby landmark: {extras.landmark}</p> : null}
            <p className="text-xs text-slate-500">For privacy, the exact property pin and street address are not shown publicly.</p>
            <a className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${mapSearch}`}>Explore this area on Google Maps ↗</a>
          </Card>
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">Facilities & suitable for</h2>
            {extras.facilities.length ? <ul className="flex flex-wrap gap-2">{extras.facilities.map((facility) => <li key={facility}><Badge>{facility}</Badge></li>)}</ul> : <p className="text-sm text-slate-600">No facilities listed.</p>}
            {extras.audiences.length ? <p className="text-sm text-slate-700">Suitable for: {extras.audiences.map((a) => AUDIENCE_LABELS[a as keyof typeof AUDIENCE_LABELS] ?? a).join(", ")}</p> : null}
          </Card>
        </div>
        <aside className="space-y-4">
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">Contact the owner</h2>
            <p className="text-sm text-slate-600">{extras.ownerName ? `Listed by ${extras.ownerName}` : "Listing owner"}</p>
            {phone ? <a className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 font-semibold text-slate-900" href={`tel:${phone}`}>Call {phone}</a> : null}
            {whatsapp ? <a className="flex min-h-11 items-center justify-center rounded-lg bg-green-700 px-4 font-semibold text-white" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello, I found your listing on THAKBO: ${listing.title}`)}`}>Message on WhatsApp</a> : null}
            {!phone && !whatsapp ? <p className="text-sm text-slate-600">No contact number has been added. You can still report incorrect information below.</p> : null}
            <p className="text-xs text-slate-500">Never send advance money before verifying the place and owner in person.</p>
          </Card>
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">Report this listing</h2>
            {reportSuccess ? <Alert tone="success">{actionData.message}</Alert> : null}
            {reportError ? <Alert tone="error">{actionData.message}</Alert> : null}
            {signedIn ? <Form method="post" className="space-y-3">
              <input type="hidden" name="intent" value="report" />
              <label className="block text-sm font-medium text-slate-800" htmlFor="report-reason">Reason</label>
              <select id="report-reason" name="reason" required className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base">
                <option value="">Choose a reason</option>{REPORT_REASONS.map((reason) => <option key={reason} value={reason}>{REPORT_LABELS[reason]}</option>)}
              </select>
              <label className="block text-sm font-medium text-slate-800" htmlFor="report-details">Details (optional)</label>
              <textarea id="report-details" name="details" maxLength={1000} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base" placeholder="Tell us what seems wrong." />
              <Button type="submit" variant="secondary" className="w-full">Send report</Button>
            </Form> : <p className="text-sm text-slate-600">Please <Link className="font-semibold text-brand-800 underline" to={`${PATHS.login}?redirectTo=${encodeURIComponent(`/listing/${listing.slug}`)}`}>sign in</Link> to save or report this place.</p>}
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}
