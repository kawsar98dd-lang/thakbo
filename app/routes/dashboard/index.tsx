import { Link } from "react-router";
import type { Route } from "./+types/index";
import { PageHeader } from "~/components/layout/PageContainer";
import { Card } from "~/components/ui/Card";
import { ButtonLink } from "~/components/ui/Button";
import { PATHS } from "~/lib/routes";
import { cloudflareContext } from "~/server/context.server";
import { listFavoriteListings } from "~/server/db/repositories/engagement";
import { getListingViewCounts } from "~/server/analytics/analytics.server";
import { listOwnedListings } from "~/server/db/repositories/listings";
import { requireUser } from "~/server/session.server";

export const meta = () => [{ title: "Dashboard · THAKBO" }, { name: "robots", content: "noindex" }];
export async function loader({ context, request }: Route.LoaderArgs) {
  const user = requireUser(context, request); const { env } = context.get(cloudflareContext);
  const [listings, favorites] = await Promise.all([listOwnedListings(env.DB, user.id), listFavoriteListings(env.DB, user.id)]);
  // Only published listings have public view counts; private drafts and moderation states are excluded.
  const publishedListings = listings.filter((listing) => listing.status === "published");
  const viewCounts = await getListingViewCounts(env.DB, publishedListings.map((listing) => listing.id));
  const listingViews = publishedListings.map((listing) => ({
    id: listing.id,
    title: listing.title ?? "Untitled listing",
    views: viewCounts.get(listing.id) ?? 0,
  }));
  return {
    name: user.name,
    listings,
    favoriteCount: favorites.length,
    publishedListingViews: listingViews.reduce((total, item) => total + item.views, 0),
    mostViewedListing: [...listingViews].sort((a, b) => b.views - a.views)[0] ?? null,
  };
}
export default function DashboardHome({ loaderData }: Route.ComponentProps) {
  const counts = loaderData.listings.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  return <>
    <PageHeader title={`Welcome, ${loaderData.name}`} description="Your THAKBO activity in one place." actions={<ButtonLink to={PATHS.newListing}>Add a place</ButtonLink>} />
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li><Card><p className="text-sm text-slate-600">Your listings</p><p className="my-2 text-3xl font-bold">{loaderData.listings.length}</p><Link className="font-semibold text-brand-800 underline" to={PATHS.myListings}>Manage listings →</Link></Card></li>
      <li><Card><p className="text-sm text-slate-600">Waiting for review</p><p className="my-2 text-3xl font-bold">{counts.pending || 0}</p><Link className="font-semibold text-brand-800 underline" to={PATHS.myListings}>Check status →</Link></Card></li>
      <li><Card><p className="text-sm text-slate-600">Saved places</p><p className="my-2 text-3xl font-bold">{loaderData.favoriteCount}</p><Link className="font-semibold text-brand-800 underline" to={PATHS.favorites}>View saved places →</Link></Card></li>
      <li><Card><p className="text-sm text-slate-600">Views on your live places</p><p className="my-2 text-3xl font-bold">{loaderData.publishedListingViews}</p><Link className="font-semibold text-brand-800 underline" to={PATHS.myListings}>View your listings →</Link></Card></li>
    </ul>
    {loaderData.mostViewedListing ? <Card className="mt-5"><h2 className="font-semibold">Your most-viewed live place</h2><p className="mt-2">{loaderData.mostViewedListing.title}</p><p className="mt-1 text-sm text-slate-600">{loaderData.mostViewedListing.views} tracked views</p><p className="mt-2 text-xs text-slate-500">Counts are approximate and exclude detectable bots; repeat views from the same browser are limited per day.</p></Card> : null}
    <Card className="mt-5"><h2 className="font-semibold">Quick start</h2><ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-700"><li>Complete your contact details in <Link className="font-semibold underline" to={PATHS.profile}>your profile</Link>.</li><li>Add your place and upload clear, recent photos.</li><li>Submit it for moderation. It appears publicly after approval.</li></ol></Card>
  </>;
}
