import { Link } from "react-router";
import type { Route } from "./+types/index";
import { PageHeader } from "~/components/layout/PageContainer";
import { Card } from "~/components/ui/Card";
import { ButtonLink } from "~/components/ui/Button";
import { PATHS } from "~/lib/routes";
import { cloudflareContext } from "~/server/context.server";
import { listFavoriteListings } from "~/server/db/repositories/engagement";
import { listOwnedListings } from "~/server/db/repositories/listings";
import { requireUser } from "~/server/session.server";

export const meta = () => [{ title: "Dashboard · THAKBO" }, { name: "robots", content: "noindex" }];
export async function loader({ context, request }: Route.LoaderArgs) {
  const user = requireUser(context, request); const { env } = context.get(cloudflareContext);
  const [listings, favorites] = await Promise.all([listOwnedListings(env.DB, user.id), listFavoriteListings(env.DB, user.id)]);
  return { name: user.name, listings, favoriteCount: favorites.length };
}
export default function DashboardHome({ loaderData }: Route.ComponentProps) {
  const counts = loaderData.listings.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  return <>
    <PageHeader title={`Welcome, ${loaderData.name}`} description="Your THAKBO activity in one place." actions={<ButtonLink to={PATHS.newListing}>Add a place</ButtonLink>} />
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li><Card><p className="text-sm text-slate-600">Your listings</p><p className="my-2 text-3xl font-bold">{loaderData.listings.length}</p><Link className="font-semibold text-brand-800 underline" to={PATHS.myListings}>Manage listings →</Link></Card></li>
      <li><Card><p className="text-sm text-slate-600">Waiting for review</p><p className="my-2 text-3xl font-bold">{counts.pending || 0}</p><Link className="font-semibold text-brand-800 underline" to={PATHS.myListings}>Check status →</Link></Card></li>
      <li><Card><p className="text-sm text-slate-600">Saved places</p><p className="my-2 text-3xl font-bold">{loaderData.favoriteCount}</p><Link className="font-semibold text-brand-800 underline" to={PATHS.favorites}>View saved places →</Link></Card></li>
    </ul>
    <Card className="mt-5"><h2 className="font-semibold">Quick start</h2><ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-700"><li>Complete your contact details in <Link className="font-semibold underline" to={PATHS.profile}>your profile</Link>.</li><li>Add your place and upload clear, recent photos.</li><li>Submit it for moderation. It appears publicly after approval.</li></ol></Card>
  </>;
}
