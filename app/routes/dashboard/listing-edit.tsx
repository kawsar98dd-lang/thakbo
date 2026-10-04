import type { Route } from "./+types/listing-edit";
import { PageHeader } from "~/components/layout/PageContainer";
import { Card } from "~/components/ui/Card";
import { uuidParam } from "~/lib/validation/common";
import { cloudflareContext } from "~/server/context.server";
import { getOwnedListing } from "~/server/db/repositories/listings";
import { notFound } from "~/server/errors.server";
import { requireUser } from "~/server/session.server";

/**
 * Reference implementation of owner authorization (blueprint §19):
 * the owner id comes from the verified session, never from the URL or form.
 * Someone else's listing looks exactly like a missing one (404), so ids cannot be probed.
 */
export async function loader({ params, context, request }: Route.LoaderArgs) {
  const user = requireUser(context, request);
  const id = uuidParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const listing = await getOwnedListing(context.get(cloudflareContext).env.DB, id.data, user.id);
  if (!listing) throw notFound();
  return { listing };
}

export default function ListingEdit({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader title="Edit listing" description={loaderData.listing.title ?? "Untitled draft"} />
      <Card>
        <p className="text-slate-700">The listing editor is planned for Milestone 3.</p>
      </Card>
    </>
  );
}
