import type { ReactNode } from "react";
import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/listing-review";
import { PageHeader } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Badge } from "~/components/ui/Badge";
import { Button, ButtonLink } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import {
  AVAILABILITY_LABELS,
  LISTING_STATUS_LABELS,
  MODERATION_ACTION_LABELS,
  PROPERTY_TYPE_LABELS,
  REJECTION_REASON_LIMITS,
} from "~/lib/constants";
import { formatTaka } from "~/lib/cost";
import { listingImagePath, PATHS } from "~/lib/routes";
import { uuidParam } from "~/lib/validation/common";
import { cloudflareContext } from "~/server/context.server";
import { getListingForReview, listModerationEvents } from "~/server/db/repositories/moderation";
import { notFound } from "~/server/errors.server";
import { approveListing, moderationMessage, rejectListing } from "~/server/moderation-service.server";
import { requireAdmin } from "~/server/session.server";

export const meta = () => [{ title: "Review listing · THAKBO" }, { name: "robots", content: "noindex" }];

/** Contains private data (exact address, coordinates, owner contact): reachable only after requireAdmin. */
export async function loader({ params, context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireAdmin(context, request, env.DB);
  const id = uuidParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const listing = await getListingForReview(env.DB, id.data);
  if (!listing) throw notFound();
  const events = await listModerationEvents(env.DB, id.data);
  // The owner's internal id is not needed by the page; only whether the reviewer owns this listing.
  const { ownerId, ...visible } = listing;
  return { listing: visible, events, isOwnListing: ownerId === user.id };
}

interface ReviewActionData {
  tone: "success" | "error";
  message: string;
  reasonError?: string;
  reason?: string;
}

/** Approve / reject. The reviewer is the signed-in admin; the service re-verifies the role and refuses own listings. */
export async function action({ params, context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireAdmin(context, request, env.DB);
  const id = uuidParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "approve") {
    const result = await approveListing(env.DB, user.id, id.data);
    if (result.ok) return redirect(`${PATHS.adminListings}?status=pending`);
    return data<ReviewActionData>({ tone: "error", message: moderationMessage(result) }, { status: result.kind === "conflict" ? 409 : result.kind === "not_found" ? 404 : 403 });
  }
  if (intent === "reject") {
    const reason = form.get("reason");
    const result = await rejectListing(env.DB, user.id, id.data, reason);
    if (result.ok) return redirect(`${PATHS.adminListings}?status=pending`);
    const text = typeof reason === "string" ? reason : "";
    if (result.kind === "invalid") return data<ReviewActionData>({ tone: "error", message: "Please fix the reason.", reasonError: result.errors.reason, reason: text }, { status: 400 });
    return data<ReviewActionData>({ tone: "error", message: moderationMessage(result), reason: text }, { status: result.kind === "conflict" ? 409 : result.kind === "not_found" ? 404 : 403 });
  }
  return data<ReviewActionData>({ tone: "error", message: "Unknown action." }, { status: 400 });
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <dt className="font-medium text-slate-700">{label}</dt>
      <dd className="col-span-2 break-words text-slate-900">{children}</dd>
    </div>
  );
}

export default function ReviewListing({ loaderData, actionData }: Route.ComponentProps) {
  const { listing, events, isOwnListing } = loaderData;
  const canDecide = listing.status === "pending" && !isOwnListing;
  const hasPoint = listing.latitude !== null && listing.longitude !== null;
  return (
    <>
      <PageHeader
        title={listing.title ?? "Untitled listing"}
        description="Check the information, photos and contact before deciding."
        actions={<ButtonLink to={PATHS.adminListings} variant="secondary">Back to queue</ButtonLink>}
      />
      <div className="space-y-4">
        {actionData ? <Alert tone={actionData.tone}>{actionData.message}</Alert> : null}
        {isOwnListing ? <Alert tone="info">This is your own listing. You cannot approve or reject it; another moderator must.</Alert> : null}
        {listing.status === "rejected" && listing.rejectionReason ? (
          <Alert tone="error" title="Rejection reason"><span className="whitespace-pre-line">{listing.rejectionReason}</span></Alert>
        ) : null}

        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone={listing.status === "rejected" ? "danger" : listing.status === "published" ? "brand" : "warning"}>{LISTING_STATUS_LABELS[listing.status]}</Badge>
            <Badge tone="brand">{PROPERTY_TYPE_LABELS[listing.propertyType]}</Badge>
            <Badge>{AVAILABILITY_LABELS[listing.availabilityStatus]}</Badge>
          </div>
          <dl className="space-y-2">
            <Row label="Description"><span className="whitespace-pre-line">{listing.description ?? "—"}</span></Row>
            <Row label="Area">{listing.areaName ?? "—"}, {listing.cityName ?? "—"}</Row>
            <Row label="Address">{listing.address ?? "—"}</Row>
            <Row label="Landmark">{listing.landmark ?? "—"}</Row>
            <Row label="Map point">
              {hasPoint ? (
                <a className="font-medium text-brand-800 underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps?q=${listing.latitude},${listing.longitude}`}>
                  Open on map ({listing.latitude}, {listing.longitude})
                </a>
              ) : "—"}
            </Row>
            <Row label="Rent">{formatTaka(listing.rentAmount)} / month</Row>
            <Row label="Deposit">{formatTaka(listing.advanceAmount)}</Row>
            <Row label="Audience">{listing.audiences.join(", ") || "—"}</Row>
            <Row label="Facilities">{listing.facilities.join(", ") || "—"}</Row>
          </dl>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-lg font-bold">Owner (private)</h2>
          <dl className="space-y-2">
            <Row label="Name">{listing.ownerName ?? "—"}</Row>
            <Row label="Phone">{listing.ownerPhone ?? "—"}</Row>
            <Row label="WhatsApp">{listing.ownerWhatsapp ?? "—"}</Row>
          </dl>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Photos ({listing.imageIds.length})</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {listing.imageIds.map((imageId) => (
              <li key={imageId}><img src={listingImagePath(imageId)} alt="Listing photo" loading="lazy" decoding="async" className="aspect-[4/3] w-full rounded-lg border border-slate-200 object-cover" /></li>
            ))}
          </ul>
        </Card>

        {canDecide ? (
          <Card className="space-y-4">
            <h2 className="text-lg font-bold">Decision</h2>
            <Form method="post">
              <input type="hidden" name="intent" value="approve" />
              <Button type="submit" size="lg" className="w-full">Approve and publish</Button>
            </Form>
            <Form method="post" className="space-y-2">
              <input type="hidden" name="intent" value="reject" />
              <label htmlFor="reason" className="block text-sm font-medium text-slate-800">Reason for rejecting (shown to the owner)</label>
              <textarea
                id="reason"
                name="reason"
                rows={4}
                required
                minLength={REJECTION_REASON_LIMITS.min}
                maxLength={REJECTION_REASON_LIMITS.max}
                defaultValue={actionData?.reason ?? ""}
                aria-invalid={actionData?.reasonError ? true : undefined}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
              />
              <p className="text-xs text-slate-600">{REJECTION_REASON_LIMITS.min}–{REJECTION_REASON_LIMITS.max} characters. Say what the owner must fix.</p>
              {actionData?.reasonError ? <p className="text-sm font-medium text-red-700">{actionData.reasonError}</p> : null}
              <Button type="submit" variant="danger" size="lg" className="w-full">Reject listing</Button>
            </Form>
          </Card>
        ) : null}

        <Card className="space-y-2">
          <h2 className="text-lg font-bold">History</h2>
          {events.length === 0 ? <p className="text-sm text-slate-600">No history yet.</p> : (
            <ol className="space-y-2">
              {events.map((event) => (
                <li key={event.id} className="text-sm">
                  <span className="font-semibold">{MODERATION_ACTION_LABELS[event.action]}</span>{" "}
                  <span className="text-slate-600">({event.fromStatus} → {event.toStatus}) by {event.actorName ?? "unknown"} [{event.actorRole}] · {event.createdAt.slice(0, 16).replace("T", " ")} UTC</span>
                  {event.reason ? <p className="whitespace-pre-line text-slate-800">“{event.reason}”</p> : null}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
