import { Link } from "react-router";
import type { Route } from "./+types/area";
import { ListingCard } from "~/components/listing/ListingCard";
import { Breadcrumbs } from "~/components/seo/Breadcrumbs";
import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { buttonClasses } from "~/components/ui/Button";
import { cityPath } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { parseSearchParams } from "~/lib/validation/search";
import { slugParam } from "~/lib/validation/common";
import { cloudflareContext } from "~/server/context.server";
import { getAreaBySlug, getCityBySlug } from "~/server/db/repositories/locations";
import { searchListings } from "~/server/db/repositories/listings";
import { notFound } from "~/server/errors.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const citySlug = slugParam.safeParse(params.city);
  const areaSlug = slugParam.safeParse(params.area);
  if (!citySlug.success || !areaSlug.success) throw notFound();
  const { env } = context.get(cloudflareContext);
  const city = await getCityBySlug(env.DB, citySlug.data);
  const area = city ? await getAreaBySlug(env.DB, city.id, areaSlug.data) : null;
  if (!city || !area) throw notFound();
  const search = parseSearchParams(new URLSearchParams({ city: city.slug, area: area.slug }));
  const result = await searchListings(env.DB, { ...search, pageSize: 20 });
  return { city, area, listings: result.items, hasMoreListings: result.hasMore };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return buildMeta({ title: "Area not found", description: "This area is not available.", noindex: true });
  const { city, area, listings } = loaderData;
  return buildMeta({
    title: `${area.name}, ${city.name}-এ বাসা ভাড়া ও রুম`,
    description: `${area.name}, ${city.name}-এ বাসা ভাড়া, রুম, ফ্ল্যাট, সাবলেট ও মেসের প্রকাশিত লিস্টিং দেখুন। মাসিক ভাড়া ও থাকার জায়গার তথ্য তুলনা করুন। Browse published accommodation in this area.`,
    noindex: listings.length === 0,
  });
}

export default function AreaPage({ loaderData }: Route.ComponentProps) {
  const { city, area, listings, hasMoreListings } = loaderData;
  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Home", path: "/" }, { label: city.name, path: cityPath(city.slug) }, { label: area.name }]} />
      <PageHeader
        title={`${area.name}, ${city.name}`}
        description={`${area.name}, ${city.name}-এ বাসা ভাড়া, রুম ভাড়া ও মেসের প্রকাশিত লিস্টিং দেখুন। Compare listings and monthly rent, or browse other areas in ${city.name}.`}
      />
      <div className="mb-8 flex flex-wrap gap-3">
        <Link className={buttonClasses("primary")} to={`/search?city=${encodeURIComponent(city.slug)}&area=${encodeURIComponent(area.slug)}`}>
          Search this area
        </Link>
        <Link className={buttonClasses("secondary")} to={cityPath(city.slug)}>
          All areas in {city.name}
        </Link>
      </div>
      <section aria-labelledby="area-listings-heading">
        <h2 id="area-listings-heading" className="mb-4 text-lg font-semibold">Published places in {area.name}</h2>
        {listings.length > 0 ? (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => <li key={listing.slug}><ListingCard listing={listing} /></li>)}
            </ul>
            {hasMoreListings ? (
              <p className="mt-4 text-sm text-slate-600">
                Showing the latest 20 listings. <Link className="font-semibold text-brand-800 underline" to={`/search?city=${encodeURIComponent(city.slug)}&area=${encodeURIComponent(area.slug)}`}>View all results</Link>.
              </p>
            ) : null}
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-slate-600">
            There are no published listings in this area yet. Please check back later.
          </p>
        )}
      </section>
    </PageContainer>
  );
}
