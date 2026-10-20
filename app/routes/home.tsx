import { Form, Link } from "react-router";
import type { Route } from "./+types/home";
import { SelectField } from "~/components/forms/SelectField";
import { PageContainer } from "~/components/layout/PageContainer";
import { Button, ButtonLink } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS, SITE } from "~/lib/constants";
import { ListingCard } from "~/components/listing/ListingCard";
import { areaPath, PATHS } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { cloudflareContext } from "~/server/context.server";
import { listActiveAreas, listActiveCities, type Area, type City } from "~/server/db/repositories/locations";
import { searchListings, type ListingCard as ListingCardData } from "~/server/db/repositories/listings";
import { parseSearchParams } from "~/lib/validation/search";
import { logger } from "~/server/logger.server";

export const meta = () => buildMeta({ title: SITE.name, description: SITE.description });

interface PopularPlace {
  city: City;
  areas: Area[];
}

const RECENT_LISTINGS_LIMIT = 12;

export async function loader({ context }: Route.LoaderArgs): Promise<{ cities: City[]; popular: PopularPlace[]; recentListings: ListingCardData[]; hasMoreListings: boolean }> {
  const { env } = context.get(cloudflareContext);
  let cities: City[] = [];
  let popular: PopularPlace[] = [];
  let recentListings: ListingCardData[] = [];
  let hasMoreListings = false;

  try {
    // Cities and areas come from the database: adding a new city needs no code change.
    cities = await listActiveCities(env.DB);
    popular = await Promise.all(
      cities.slice(0, 3).map(async (city) => ({ city, areas: (await listActiveAreas(env.DB, city.id)).slice(0, 8) })),
    );
  } catch (error) {
    // Keep the homepage usable if location data is temporarily unavailable.
    logger.warn("home: location lookup failed", { error });
  }

  try {
    const recent = await searchListings(env.DB, {
      ...parseSearchParams(new URLSearchParams("sort=newest")),
      pageSize: RECENT_LISTINGS_LIMIT,
    });
    recentListings = recent.items;
    hasMoreListings = recent.hasMore;
  } catch (error) {
    // A listing-feed failure must not take down the hero, search, or popular areas.
    logger.warn("home: recent listing lookup failed", { error });
  }

  return { cities, popular, recentListings, hasMoreListings };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { cities, popular, recentListings, hasMoreListings } = loaderData;
  return (
    <>
      <section className="-mt-6 bg-brand-800 py-12 text-white sm:-mt-8 sm:py-16">
        <PageContainer>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-200">
            {SITE.name} <span lang="bn" className="normal-case tracking-normal">· {SITE.nameBn}</span>
          </p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">{SITE.tagline}</h1>
          <p className="mt-3 max-w-xl text-brand-100">Find a place to live near where you want to be.</p>
          <Form
            method="get"
            action={PATHS.search}
            className="mt-6 grid max-w-3xl gap-3 rounded-xl bg-white p-4 text-slate-900 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <SelectField label="City" name="city" placeholder="Any city" options={cities.map((c) => ({ value: c.slug, label: c.name }))} />
            <SelectField
              label="What are you looking for?"
              name="type"
              placeholder="Any property"
              options={PROPERTY_TYPES.map((value) => ({ value, label: PROPERTY_TYPE_LABELS[value] }))}
            />
            <Button type="submit" size="lg">
              Search places
            </Button>
          </Form>
        </PageContainer>
      </section>

      <PageContainer className="mt-10 space-y-10">
        <section id="explore" aria-labelledby="popular-heading" className="scroll-mt-20">
          <h2 id="popular-heading" className="text-xl font-bold">
            Popular areas
          </h2>
          {popular.length === 0 ? (
            <p className="mt-2 text-slate-600">Areas will appear here once locations are added.</p>
          ) : (
            popular.map(({ city, areas }) => (
              <div key={city.id} className="mt-4">
                <h3 className="font-semibold text-slate-800">{city.name}</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
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
              </div>
            ))
          )}
        </section>

        <section id="recent-listings" aria-labelledby="recent-listings-heading" className="scroll-mt-20">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Fresh on THAKBO</p>
              <h2 id="recent-listings-heading" className="mt-1 text-xl font-bold sm:text-2xl">Recent places to rent</h2>
              <p className="mt-1 text-sm text-slate-600">The latest published places, with newest posts shown first.</p>
            </div>
            {recentListings.length > 0 ? (
              <ButtonLink to="/search?sort=newest" variant="secondary">View all places</ButtonLink>
            ) : null}
          </div>
          {recentListings.length > 0 ? (
            <>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentListings.map((listing) => <li key={listing.slug}><ListingCard listing={listing} /></li>)}
              </ul>
              {hasMoreListings ? (
                <div className="mt-6 text-center">
                  <ButtonLink to="/search?sort=newest" size="lg" variant="secondary">Browse more listings</ButtonLink>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center sm:px-8">
              <h3 className="font-semibold text-slate-900">No published places yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">New places will appear here after they are reviewed and published. Please check back soon.</p>
              <ButtonLink to={PATHS.newListing} className="mt-4" size="lg">List a Place</ButtonLink>
            </div>
          )}
        </section>

        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Have a place to rent out?</h2>
            <p className="text-slate-600">One account lets you search and list.</p>
          </div>
          <ButtonLink to={PATHS.newListing} size="lg">
            List a Place
          </ButtonLink>
        </Card>
      </PageContainer>
    </>
  );
}
