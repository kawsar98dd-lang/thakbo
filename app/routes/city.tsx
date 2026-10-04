import { Link } from "react-router";
import type { Route } from "./+types/city";
import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { areaPath } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { slugParam } from "~/lib/validation/common";
import { cloudflareContext } from "~/server/context.server";
import { getCityBySlug, listActiveAreas } from "~/server/db/repositories/locations";
import { notFound } from "~/server/errors.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const slug = slugParam.safeParse(params.city);
  if (!slug.success) throw notFound();
  const { env } = context.get(cloudflareContext);
  const city = await getCityBySlug(env.DB, slug.data);
  if (!city) throw notFound();
  return { city, areas: await listActiveAreas(env.DB, city.id) };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return buildMeta({ title: "City not found", description: "This city is not available.", noindex: true });
  return buildMeta({
    title: `Places to rent in ${loaderData.city.name}`,
    description: `Browse mess, rooms, flats and houses across ${loaderData.city.name}.`,
  });
}

export default function CityPage({ loaderData }: Route.ComponentProps) {
  const { city, areas } = loaderData;
  return (
    <PageContainer>
      <PageHeader title={`Places to rent in ${city.name}`} description="Choose an area to start." />
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
    </PageContainer>
  );
}
