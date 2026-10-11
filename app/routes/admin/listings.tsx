import { Link } from "react-router";
import type { Route } from "./+types/listings";
import { PageHeader } from "~/components/layout/PageContainer";
import { Badge } from "~/components/ui/Badge";
import { Card } from "~/components/ui/Card";
import { EmptyState } from "~/components/ui/EmptyState";
import { LISTING_STATUS_LABELS, PROPERTY_TYPE_LABELS, REVIEWABLE_STATUSES, type ListingStatus } from "~/lib/constants";
import { formatTaka } from "~/lib/cost";
import { adminListingPath, PATHS } from "~/lib/routes";
import { cloudflareContext } from "~/server/context.server";
import { listListingsForModeration } from "~/server/db/repositories/moderation";
import { requireAdmin } from "~/server/session.server";

export const meta = () => [{ title: "Listings moderation · THAKBO" }, { name: "robots", content: "noindex" }];

/** Admin/moderator only (checked again here, not only in the layout). Default view: the pending queue, oldest first. */
export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(context, request, env.DB);
  const requested = new URL(request.url).searchParams.get("status");
  const status: ListingStatus = REVIEWABLE_STATUSES.find((value) => value === requested) ?? "pending";
  return { status, items: await listListingsForModeration(env.DB, status) };
}

const TABS: ListingStatus[] = ["pending", "rejected", "published", "paused"];

export default function AdminListings({ loaderData }: Route.ComponentProps) {
  const { status, items } = loaderData;
  return (
    <>
      <PageHeader title="Listings moderation" description="Review listings that owners submitted. Oldest submissions come first." />
      <nav aria-label="Listing status" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab}
            to={`${PATHS.adminListings}?status=${tab}`}
            aria-current={tab === status ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold ${tab === status ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-900"}`}
          >
            {LISTING_STATUS_LABELS[tab]}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState icon="check" title="Nothing here" description={status === "pending" ? "No listing is waiting for review." : "No listings with this status."} />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={item.status === "rejected" ? "danger" : item.status === "published" ? "brand" : "warning"}>{LISTING_STATUS_LABELS[item.status]}</Badge>
                  <Badge tone="brand">{PROPERTY_TYPE_LABELS[item.propertyType]}</Badge>
                </div>
                <h2 className="text-base font-semibold">{item.title ?? "Untitled"}</h2>
                <p className="text-sm text-slate-600">
                  {item.areaName ?? "—"}, {item.cityName ?? "—"} · {formatTaka(item.rentAmount)} · {item.imageCount} photo(s) · by {item.ownerName ?? "unknown"}
                </p>
                <p className="text-xs text-slate-600">Submitted {(item.submittedAt ?? item.updatedAt).slice(0, 16).replace("T", " ")} UTC</p>
                <Link to={adminListingPath(item.id)} className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline">
                  Review
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
