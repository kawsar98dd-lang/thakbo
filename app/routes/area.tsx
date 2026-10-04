import { Link } from "react-router";
import type { Route } from "./+types/area";
import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { buttonClasses } from "~/components/ui/Button";
import { cityPath } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { slugParam } from "~/lib/validation/common";
import { cloudflareContext } from "~/server/context.server";
import { getAreaBySlug, getCityBySlug } from "~/server/db/repositories/locations";
import { notFound } from "~/server/errors.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const citySlug = slugParam.safeParse(params.city);
  const areaSlug = slugParam.safeParse(params.area);
  if (!citySlug.success || !areaSlug.success) throw notFound();
  const { env } = context.get(cloudflareContext);
  const city = await getCityBySlug(env.DB, citySlug.data);
  const area = city ? await getAreaBySlug(env.DB, city.id, areaSlug.data) : null;
  if (!city || !area) throw notFound();
  return { city, area };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return buildMeta({ title: "Area not found", description: "This area is not available.", noindex: true });
  const { city, area } = loaderData;
  return buildMeta({
    title: `Places to rent in ${area.name}, ${city.name}`,
    description: `Find mess, rooms, flats and houses in ${area.name}, ${city.name}.`,
  });
}

export default function AreaPage({ loaderData }: Route.ComponentProps) {
  const { city, area } = loaderData;
  return (
    <PageContainer>
      <PageHeader title={`${area.name}, ${city.name}`} description="Listings, map and related areas arrive in Milestones 4 and 5." />
      <div className="flex flex-wrap gap-3">
        <Link className={buttonClasses("primary")} to={`/search?city=${encodeURIComponent(city.slug)}&area=${encodeURIComponent(area.slug)}`}>
          Search this area
        </Link>
        <Link className={buttonClasses("secondary")} to={cityPath(city.slug)}>
          All areas in {city.name}
        </Link>
      </div>
    </PageContainer>
  );
}
