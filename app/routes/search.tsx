import { Link } from "react-router";
import type { Route } from "./+types/search";
import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { ListingCard } from "~/components/listing/ListingCard";
import { SearchFilters } from "~/components/search/SearchFilters";
import { buttonClasses } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { buildMeta } from "~/lib/seo";
import { parseSearchParams, type SearchParams } from "~/lib/validation/search";
import { cloudflareContext } from "~/server/context.server";
import { searchListings } from "~/server/db/repositories/listings";
import { listActiveCities } from "~/server/db/repositories/locations";

// Filter combinations must never be indexed (blueprint §16).
export const meta = () =>
  buildMeta({ title: "Search places", description: "Search accommodation by location, price and type.", noindex: true });

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const search = parseSearchParams(new URL(request.url).searchParams);
  const [cities, result] = await Promise.all([listActiveCities(env.DB), searchListings(env.DB, search)]);
  return { cities, result, search };
}

function pageHref(search: SearchParams, page: number): string {
  const params = new URLSearchParams();
  if (search.city) params.set("city", search.city);
  if (search.area) params.set("area", search.area);
  for (const t of search.types) params.append("type", t);
  for (const a of search.audiences) params.append("audience", a);
  if (search.minPrice !== undefined) params.set("min_price", String(search.minPrice));
  if (search.maxPrice !== undefined) params.set("max_price", String(search.maxPrice));
  params.set("sort", search.sort);
  params.set("page", String(page));
  return `/search?${params.toString()}`;
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { cities, result, search } = loaderData;
  return (
    <PageContainer>
      <PageHeader title="Search places" description="Filters are saved in the address bar, so you can share the link." />
      <SearchFilters cities={cities} values={search} />
      <section aria-label="Results" className="mt-6">
        {result.items.length === 0 ? (
          <EmptyState title="No places found" description="Try a different city, a higher price or fewer filters." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((listing) => (
              <li key={listing.id}>
                <ListingCard listing={listing} />
              </li>
            ))}
          </ul>
        )}
        <nav aria-label="Pagination" className="mt-6 flex justify-between">
          {result.page > 1 ? (
            <Link className={buttonClasses("secondary")} to={pageHref(search, result.page - 1)}>
              Previous
            </Link>
          ) : (
            <span />
          )}
          {result.hasMore ? (
            <Link className={buttonClasses("secondary")} to={pageHref(search, result.page + 1)}>
              Next
            </Link>
          ) : null}
        </nav>
      </section>
    </PageContainer>
  );
}
