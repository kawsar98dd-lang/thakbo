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
      <section className="relative -mt-6 isolate overflow-hidden bg-gradient-to-br from-[#123c36] via-brand-800 to-[#247b6c] py-12 text-white sm:-mt-8 sm:py-16 lg:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 -z-10 size-80 rounded-full border border-white/10 bg-white/[0.03] sm:size-[28rem]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 left-[42%] -z-10 size-96 rounded-full border border-white/10" />
        <PageContainer className="relative">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-brand-200 sm:text-sm">
            {SITE.name} <span lang="bn" className="normal-case tracking-normal">· {SITE.nameBn}</span>
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">{SITE.tagline}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-brand-100 sm:text-lg">Find a place to live near where you want to be. Explore rooms, homes and shared spaces across Bangladesh.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-white/90 sm:text-sm"><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">⌖ Location-first discovery</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">✓ Reviewed listings</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">♡ Save your favourites</span></div>
          <Form
            method="get"
            action={PATHS.search}
            className="hero-search mt-7 grid max-w-4xl gap-3 bg-white p-4 text-slate-900 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-5"
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

      <PageContainer className="mt-10 space-y-12 sm:mt-12 sm:space-y-14 lg:mt-14">
        <section id="explore" aria-labelledby="popular-heading" className="scroll-mt-20">
          <p className="section-kicker">Explore by location</p>
          <h2 id="popular-heading" className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Popular areas
          </h2>
          {popular.length === 0 ? (
            <p className="mt-2 text-slate-600">Areas will appear here once locations are added.</p>
          ) : (
            popular.map(({ city, areas }) => (
              <div key={city.id} className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
                <h3 className="flex items-center gap-2 font-bold text-slate-800"><span className="grid size-8 place-items-center rounded-xl bg-brand-50 text-brand-700">⌖</span>{city.name}</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {areas.map((area) => (
                    <li key={area.id}>
                      <Link
                        to={areaPath(city.slug, area.slug)}
                        className="soft-link inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900"
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
              <p className="section-kicker">Fresh on THAKBO</p>
              <h2 id="recent-listings-heading" className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Recent places to rent</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Discover newly published places to find a space that feels right for you.</p>
            </div>
            {recentListings.length > 0 ? (
              <ButtonLink to="/search?sort=newest" variant="secondary">View all places</ButtonLink>
            ) : null}
          </div>
          {recentListings.length > 0 ? (
            <>
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {recentListings.map((listing) => <li key={listing.slug}><ListingCard listing={listing} /></li>)}
              </ul>
              {hasMoreListings ? (
                <div className="mt-6 text-center">
                  <ButtonLink to="/search?sort=newest" size="lg" variant="secondary">Browse more listings</ButtonLink>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-brand-200 bg-gradient-to-br from-brand-50 to-white px-5 py-10 text-center sm:px-8 sm:py-12">
              <h3 className="font-semibold text-slate-900">No published places yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">New places will appear here after they are reviewed and published. Please check back soon.</p>
              <ButtonLink to={PATHS.newListing} className="mt-4" size="lg">List a Place</ButtonLink>
            </div>
          )}
        </section>

        <Card className="home-owner-cta flex flex-wrap items-center justify-between gap-5 border-brand-100 bg-gradient-to-r from-white to-brand-50/70 p-5 sm:p-7">
          <div>
            <p className="section-kicker">For owners & hosts</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">Have a place to rent out?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 sm:text-base">One account lets you discover places and publish your own listing.</p>
          </div>
          <ButtonLink to={PATHS.newListing} size="lg">
            List a Place
          </ButtonLink>
        </Card>
      </PageContainer>
    </>
  );
}
