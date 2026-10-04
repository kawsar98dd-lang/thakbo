import type { Route } from "./+types/sitemap";
import { areaPath, cityPath, STATIC_SITEMAP_PATHS } from "~/lib/routes";
import { cloudflareContext } from "~/server/context.server";
import { listSitemapLocations, type SitemapLocation } from "~/server/db/repositories/locations";
import { logger } from "~/server/logger.server";

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/**
 * Lists static pages plus every active city and area. Search-filter URLs are deliberately excluded.
 * Individual listing URLs are added in Milestone 8 (SEO).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const paths: string[] = [...STATIC_SITEMAP_PATHS];

  try {
    const locations: SitemapLocation[] = await listSitemapLocations(context.get(cloudflareContext).env.DB);
    for (const item of locations) {
      paths.push(item.areaSlug ? areaPath(item.citySlug, item.areaSlug) : cityPath(item.citySlug));
    }
  } catch (error) {
    // Still serve the static part of the sitemap if the database is unavailable.
    logger.warn("sitemap: location lookup failed", { error });
  }

  const urls = paths.map((path) => `  <url><loc>${escapeXml(origin + path)}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
