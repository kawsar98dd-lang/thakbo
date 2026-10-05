import { data, Form } from "react-router";
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
import { deleteOwnedListing } from "~/server/listing-service.server";
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
  return { listings: await listOwnedListings(env.DB, user.id) };
}

/** Delete = soft delete, and only of the session user's own listing (the id in the form is never trusted for ownership). */
export async function action({ context, request }: Route.ActionArgs) {
  const user = requireUser(context, request);
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();

  if (form.get("intent") !== "delete") {
    return data<ListingsActionData>({ tone: "error", message: "Unknown action." }, { status: 400 });
  }
  const id = uuidParam.safeParse(form.get("listingId"));
  if (!id.success) return data<ListingsActionData>({ tone: "error", message: "Invalid listing." }, { status: 400 });

  const result = await deleteOwnedListing(env.DB, user.id, id.data);
  if (!result.ok) return data<ListingsActionData>({ tone: "error", message: "This listing could not be deleted." }, { status: 404 });
  return data<ListingsActionData>({ tone: "success", message: "Listing deleted." });
}

export default function MyListings({ loaderData, actionData }: Route.ComponentProps) {
  const { listings } = loaderData;
  return (
    <>
      <PageHeader
        title="আমার লিস্টিং / My listings"
        description="Your drafts and listings. Only you can see this page."
        actions={<ButtonLink to={PATHS.newListing}>New listing</ButtonLink>}
      />
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
                <p className="text-xs text-slate-600">Updated {listing.updatedAt.slice(0, 10)}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <ButtonLink to={editListingPath(listing.id)} variant="secondary">
                    {listing.status === "draft" ? "Continue editing" : "Open"}
                  </ButtonLink>
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
