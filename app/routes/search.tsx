import { Link } from "react-router";
import type { Route } from "./+types/search";
import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { ListingCard } from "~/components/listing/ListingCard";
import { SearchFilters } from "~/components/search/SearchFilters";
import { buttonClasses } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { buildMeta } from "~/lib/seo";
import { parseSearchParams, type SearchParams } from "~/lib/validation/search";
import { slugParam } from "~/lib/validation/common";
import { cloudflareContext } from "~/server/context.server";
import { searchListings } from "~/server/db/repositories/listings";
import { listActiveCities, resolveAreaByText } from "~/server/db/repositories/locations";
import { listActiveFacilities } from "~/server/db/repositories/facilities";

// Filter combinations must never be indexed (blueprint §16).
export const meta = () =>
  buildMeta({ title: "Search places", description: "Search accommodation by location, price and type.", noindex: true });

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const search = parseSearchParams(new URL(request.url).searchParams);
  const [cities, facilities] = await Promise.all([listActiveCities(env.DB), listActiveFacilities(env.DB)]);
  const areaInput = search.area ?? "";
  let areaSearchError: string | null = null;
  let resolvedSearch = search;

  if (areaInput) {
    const selectedCity = search.city
      ? cities.find((city) => city.slug === search.city)
      : cities.length === 1 ? cities[0] : undefined;
    const matchedArea = selectedCity ? await resolveAreaByText(env.DB, selectedCity.id, areaInput) : null;
    if (matchedArea && selectedCity) {
      resolvedSearch = { ...search, city: search.city ?? selectedCity.slug, area: matchedArea.slug, page: 1 };
    } else if (slugParam.safeParse(areaInput).success) {
      // Keep direct canonical-slug filtering for shareable URLs and older links.
      resolvedSearch = { ...search, area: areaInput };
    } else {
      areaSearchError = selectedCity
        ? "We couldn't match that area. Try a known neighbourhood name in English or Bangla."
        : "Choose a city before searching an area name.";
      resolvedSearch = { ...search, area: undefined, page: 1 };
    }
  }

  const result = await searchListings(env.DB, resolvedSearch);
  return { cities, facilities, result, search: resolvedSearch, areaInput, areaSearchError };
}

function pageHref(search: SearchParams, page: number): string {
  const params = new URLSearchParams();
  if (search.city) params.set("city", search.city);
  if (search.area) params.set("area", search.area);
  for (const t of search.types) params.append("type", t);
  for (const a of search.audiences) params.append("audience", a);
  if (search.minPrice !== undefined) params.set("min_price", String(search.minPrice));
  if (search.maxPrice !== undefined) params.set("max_price", String(search.maxPrice));
  for (const f of search.facilities) params.append("facility", f);
  if (search.availableNow) params.set("available", "now");
  if (search.availableBy) params.set("available_from", search.availableBy);
  if (search.lat !== undefined && search.lng !== undefined) { params.set("lat", String(search.lat)); params.set("lng", String(search.lng)); params.set("radius", String(search.radiusKm ?? 3)); }
  params.set("sort", search.sort);
  params.set("page", String(page));
  return `/search?${params.toString()}`;
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { cities, facilities, result, search, areaInput, areaSearchError } = loaderData;
  return (
    <PageContainer>
      <PageHeader title="Search places" description="Filters are saved in the address bar, so you can share the link." />
      <SearchFilters cities={cities} facilities={facilities} values={search} areaInput={areaInput} areaSearchError={areaSearchError} />
      <section aria-label="Results" className="mt-6">
        {result.items.length === 0 ? (
          <EmptyState title="No places found" description="Try a different city, a higher price or fewer filters." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((listing) => (
              <li key={listing.slug}>
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
