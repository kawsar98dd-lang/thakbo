import { data, Form, useSearchParams } from "react-router";
import type { Route } from "./+types/listings";
import { PageHeader } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Badge } from "~/components/ui/Badge";
import { Button, ButtonLink } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { EmptyState } from "~/components/ui/EmptyState";
import { LISTING_STATUS_LABELS, PROPERTY_TYPE_LABELS, type ListingStatus } from "~/lib/constants";
import { formatTaka } from "~/lib/cost";
import { formatLocationLabel } from "~/lib/location";
import { editListingPath, PATHS } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { uuidParam } from "~/lib/validation/common";
import { cloudflareContext } from "~/server/context.server";
import { listOwnedListings } from "~/server/db/repositories/listings";
import { getListingViewCounts } from "~/server/analytics/analytics.server";
import { deleteOwnedListing, moveListingToDraft } from "~/server/listing-service.server";
import { requireUser } from "~/server/session.server";

export const meta = () => buildMeta({ title: "My listings", description: "Manage your listings.", noindex: true });

interface ListingsActionData {
  tone: "success" | "error";
  message: string;
}

const STATUS_TONE: Record<ListingStatus, "neutral" | "brand" | "warning" | "danger"> = {
  draft: "warning",
  pending: "warning",
  published: "brand",
  paused: "neutral",
  rejected: "danger",
  deleted: "neutral",
};

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = requireUser(context, request);
  const { env } = context.get(cloudflareContext);
  const listings = await listOwnedListings(env.DB, user.id);
  const publishedIds = listings.filter((listing) => listing.status === "published").map((listing) => listing.id);
  const viewCounts = await getListingViewCounts(env.DB, publishedIds);
  const withViews = listings.map((listing) => ({
    ...listing,
    // Do not expose view counts for drafts, pending, rejected, paused, or deleted listings.
    viewCount: listing.status === "published" ? viewCounts.get(listing.id) ?? 0 : null,
  }));
  return { listings: withViews };
}

/**
 * Delete (soft) and withdraw-to-draft, only for the session user's own listing (the id in the form is never trusted
 * for ownership). Submitting for review happens on the edit page, where the data can be checked and fixed.
 */
export async function action({ context, request }: Route.ActionArgs) {
  const user = requireUser(context, request);
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent !== "delete" && intent !== "to_draft") {
    return data<ListingsActionData>({ tone: "error", message: "Unknown action." }, { status: 400 });
  }
  const id = uuidParam.safeParse(form.get("listingId"));
  if (!id.success) return data<ListingsActionData>({ tone: "error", message: "Invalid listing." }, { status: 400 });

  if (intent === "to_draft") {
    const moved = await moveListingToDraft(env.DB, user.id, id.data);
    if (!moved.ok) return data<ListingsActionData>({ tone: "error", message: "This listing could not be moved back to draft." }, { status: 409 });
    return data<ListingsActionData>({ tone: "success", message: "The listing is now a private draft again." });
  }

  const result = await deleteOwnedListing(env.DB, user.id, id.data);
  if (!result.ok) return data<ListingsActionData>({ tone: "error", message: "This listing could not be deleted." }, { status: 404 });
  return data<ListingsActionData>({ tone: "success", message: "Listing deleted." });
}

const NOTICES: Record<string, string> = {
  submitted: "Your listing was submitted. A moderator will review it; you will see the result here.",
  resubmitted: "Your changes were saved. The listing is offline until a moderator approves it again.",
};

const STATUS_HELP: Partial<Record<ListingStatus, string>> = {
  pending: "Waiting for a moderator. You cannot edit it meanwhile.",
  published: "Live. Editing it takes it offline until it is approved again.",
  paused: "Hidden from visitors. Edit and resubmit it to publish again.",
};

/** A reminder only: never changes listing visibility or status automatically. */
function getFreshnessReminder(status: ListingStatus, updatedAt: string): string | null {
  if (status !== "published") return null;
  const updated = Date.parse(updatedAt);
  if (!Number.isFinite(updated)) return null;
  const ageDays = Math.floor(Math.max(0, Date.now() - updated) / 86_400_000);
  if (ageDays >= 30) return `Last updated ${ageDays} days ago. Please review the rent, location, photos, and availability to keep this listing accurate.`;
  if (ageDays >= 14) return `Last updated ${ageDays} days ago. Consider checking that the rent and availability are still correct.`;
  return null;
}

export default function MyListings({ loaderData, actionData }: Route.ComponentProps) {
  const { listings } = loaderData;
  const [searchParams] = useSearchParams();
  const notice = NOTICES[searchParams.get("notice") ?? ""];
  return (
    <>
      <PageHeader
        title="আমার লিস্টিং / My listings"
        description="Your drafts and listings. Only you can see this page."
        actions={<ButtonLink to={PATHS.newListing}>New listing</ButtonLink>}
      />
      {notice ? <div className="mb-4"><Alert tone="success">{notice}</Alert></div> : null}
      {actionData ? <div className="mb-4"><Alert tone={actionData.tone}>{actionData.message}</Alert></div> : null}
      {listings.length === 0 ? (
        <EmptyState
          icon="home"
          title="You have no listings yet"
          description="Start a draft now. You can finish it later."
          action={<ButtonLink to={PATHS.newListing}>Create your first draft</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {listings.map((listing) => (
            <li key={listing.id}>
              <Card className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={STATUS_TONE[listing.status]}>{LISTING_STATUS_LABELS[listing.status]}</Badge>
                  <Badge tone="brand">{PROPERTY_TYPE_LABELS[listing.propertyType]}</Badge>
                </div>
                <h2 className="text-base font-semibold">{listing.title ?? "Untitled draft"}</h2>
                <p className="text-sm text-slate-600">
                  {listing.areaName && listing.cityName
                    ? formatLocationLabel(
                        { name: listing.areaName, nameEn: listing.areaName, nameBn: listing.areaNameBn },
                        { name: listing.cityName, nameEn: listing.cityName, nameBn: listing.cityNameBn },
                        "en",
                      )
                    : "Location not set"}
                  {" · "}
                  {formatTaka(listing.rentAmount)}
                </p>
                {listing.status === "rejected" && listing.rejectionReason ? (
                  <Alert tone="error" title="Changes requested">
                    <span className="whitespace-pre-line">{listing.rejectionReason}</span>
                  </Alert>
                ) : null}
                {STATUS_HELP[listing.status] ? <p className="text-sm text-slate-700">{STATUS_HELP[listing.status]}</p> : null}
                {getFreshnessReminder(listing.status, listing.updatedAt) ? (
                  <Alert tone="warning" title="Keep this listing up to date">
                    {getFreshnessReminder(listing.status, listing.updatedAt)}
                  </Alert>
                ) : null}
                {listing.viewCount !== null ? <p className="text-sm text-slate-700">👁 {listing.viewCount} tracked views</p> : null}
                <p className="text-xs text-slate-600">Updated {listing.updatedAt.slice(0, 10)}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <ButtonLink to={editListingPath(listing.id)} variant="secondary">
                    {listing.status === "draft" ? "Continue editing" : listing.status === "rejected" ? "Fix and resubmit" : "Open"}
                  </ButtonLink>
                  {listing.status === "pending" ? (
                    <Form method="post">
                      <input type="hidden" name="intent" value="to_draft" />
                      <input type="hidden" name="listingId" value={listing.id} />
                      <Button type="submit" variant="secondary">
                        Withdraw
                      </Button>
                    </Form>
                  ) : null}
                  <Form
                    method="post"
                    onSubmit={(event) => {
                      if (!window.confirm("Delete this listing?")) event.preventDefault();
                    }}
                  >
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="listingId" value={listing.id} />
                    <Button type="submit" variant="ghost">
                      Delete
                    </Button>
                  </Form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
