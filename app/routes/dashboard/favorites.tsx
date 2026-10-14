import type { Route } from "./+types/favorites";
import { PageHeader } from "~/components/layout/PageContainer";
import { ListingCard } from "~/components/listing/ListingCard";
import { EmptyState } from "~/components/ui/EmptyState";
import { cloudflareContext } from "~/server/context.server";
import { listFavoriteListings } from "~/server/db/repositories/engagement";
import { requireUser } from "~/server/session.server";

export const meta = () => [{ title: "Saved places · THAKBO" }, { name: "robots", content: "noindex" }];

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = requireUser(context, request);
  const { env } = context.get(cloudflareContext);
  return { items: await listFavoriteListings(env.DB, user.id) };
}

export default function FavoritesPage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  return <>
    <PageHeader title="Saved places" description="Keep interesting accommodation together while you compare your options." />
    {items.length === 0 ? <EmptyState icon="heart" title="No saved places yet" description="Open a published listing and tap Save place to keep it here." /> :
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((listing) => <li key={listing.slug}><ListingCard listing={listing} /></li>)}</ul>}
  </>;
}
