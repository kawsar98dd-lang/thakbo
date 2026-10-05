import type { Route } from "./+types/areas";
import { AREA_SEARCH_LIMITS } from "~/lib/constants";
import { areaSearchSchema } from "~/lib/validation/location";
import { cloudflareContext } from "~/server/context.server";
import { listActiveSubAreas, searchAreas } from "~/server/db/repositories/locations";
import { logger } from "~/server/logger.server";

/**
 * Neighborhood autocomplete (public data, active places only).
 *   GET /api/areas?cityId=1            → the city's most important neighborhoods
 *   GET /api/areas?cityId=1&q=hatem    → alias-aware search ("Hatem" finds Hetem Khan)
 *   GET /api/areas?cityId=1&parentId=3 → sub-areas of neighborhood 3
 * Results are capped; the browser never receives a whole city's (or country's) location list.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const parsed = areaSearchSchema.safeParse({
    cityId: url.searchParams.get("cityId"),
    q: url.searchParams.get("q") ?? undefined,
    parentId: url.searchParams.get("parentId") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ areas: [], error: "Invalid request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const { env } = context.get(cloudflareContext);
  try {
    const { cityId, q, parentId } = parsed.data;
    const areas =
      parentId !== undefined
        ? await listActiveSubAreas(env.DB, parentId)
        : await searchAreas(env.DB, cityId, q, { limit: AREA_SEARCH_LIMITS.defaultResults });
    return Response.json({ areas }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    logger.error("area search failed", { error });
    return Response.json({ areas: [], error: "Could not load places." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
