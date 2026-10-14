import { Link } from "react-router";
import type { Route } from "./+types/city";
import { ListingCard } from "~/components/listing/ListingCard";
import { Breadcrumbs } from "~/components/seo/Breadcrumbs";
import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { areaPath } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { parseSearchParams } from "~/lib/validation/search";
import { slugParam } from "~/lib/validation/common";
import { cloudflareContext } from "~/server/context.server";
import { searchListings } from "~/server/db/repositories/listings";
import { getCityBySlug, listActiveAreas } from "~/server/db/repositories/locations";
import { notFound } from "~/server/errors.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const slug = slugParam.safeParse(params.city);
  if (!slug.success) throw notFound();
  const { env } = context.get(cloudflareContext);
  const city = await getCityBySlug(env.DB, slug.data);
  if (!city) throw notFound();
  const search = parseSearchParams(new URLSearchParams({ city: city.slug }));
  const [areas, result] = await Promise.all([
    listActiveAreas(env.DB, city.id),
    searchListings(env.DB, { ...search, pageSize: 20 }),
  ]);
  return { city, areas, listings: result.items, hasMoreListings: result.hasMore };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return buildMeta({ title: "City not found", description: "This city is not available.", noindex: true });
  const { city, listings } = loaderData;
  return buildMeta({
    title: `Places to rent in ${city.name}`,
    description: `Browse published mess seats, rooms, flats, houses and sublets in ${city.name}. Compare places by area and monthly rent.`,
    noindex: listings.length === 0,
  });
}

export default function CityPage({ loaderData }: Route.ComponentProps) {
  const { city, areas, listings, hasMoreListings } = loaderData;
  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Home", path: "/" }, { label: city.name }]} />
      <PageHeader
        title={`Places to rent in ${city.name}`}
        description={`Explore published accommodation in ${city.name}. Browse by neighbourhood or compare the latest available listings below.`}
      />
      {areas.length > 0 ? (
        <section aria-labelledby="city-areas-heading" className="mb-8">
          <h2 id="city-areas-heading" className="mb-3 text-lg font-semibold">Explore areas in {city.name}</h2>
          <ul className="flex flex-wrap gap-2">
            {areas.map((area) => (
              <li key={area.id}>
                <Link
                  to={areaPath(city.slug, area.slug)}
                  className="inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-4 text-sm hover:bg-brand-50"
                >
                  {area.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="city-listings-heading" className="mb-8">
        <h2 id="city-listings-heading" className="mb-4 text-lg font-semibold">Published places in {city.name}</h2>
        {listings.length > 0 ? (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => <li key={listing.slug}><ListingCard listing={listing} /></li>)}
            </ul>
            {hasMoreListings ? (
              <p className="mt-4 text-sm text-slate-600">
                Showing the latest 20 listings. <Link className="font-semibold text-brand-800 underline" to={`/search?city=${encodeURIComponent(city.slug)}`}>View all results</Link>.
              </p>
            ) : null}
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-slate-600">
            There are no published listings in this city yet. Please check back later.
          </p>
        )}
      </section>
    </PageContainer>
  );
}
