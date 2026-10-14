import type { Route } from "./+types/sitemap";
import { areaPath, cityPath, listingPath, STATIC_SITEMAP_PATHS } from "~/lib/routes";
import { SITE } from "~/lib/constants";
import { cloudflareContext } from "~/server/context.server";
import { listSitemapLocations, type SitemapLocation } from "~/server/db/repositories/locations";
import { listPublishedListingSlugs } from "~/server/db/repositories/listings";
import { logger } from "~/server/logger.server";

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const MAX_SITEMAP_URLS = 50_000;

/**
 * Lists public static pages, active locations and published listing detail pages.
 * Search-filter URLs and every non-published listing status are deliberately excluded.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const origin = SITE.canonicalOrigin;
  const paths = new Set<string>(STATIC_SITEMAP_PATHS);
  const db = context.get(cloudflareContext).env.DB;

  try {
    const locations: SitemapLocation[] = await listSitemapLocations(db);
    for (const item of locations) {
      paths.add(item.areaSlug ? areaPath(item.citySlug, item.areaSlug) : cityPath(item.citySlug));
    }
  } catch (error) {
    // Still serve the static part of the sitemap if the database is unavailable.
    logger.warn("sitemap: location lookup failed", { error });
  }

  // Sitemap protocol allows at most 50,000 URLs per file. Keep public pages first,
  // then use remaining slots for published listings; request one extra row to detect truncation.
  const remaining = Math.max(0, MAX_SITEMAP_URLS - paths.size);
  if (remaining > 0) {
    try {
      const listings = await listPublishedListingSlugs(db, remaining + 1);
      for (const listing of listings.slice(0, remaining)) paths.add(listingPath(listing.slug));
      if (listings.length > remaining) {
        logger.warn("sitemap: published listing URL limit reached", { limit: MAX_SITEMAP_URLS });
      }
    } catch (error) {
      // A listing query failure should not take down the static/location sitemap.
      logger.warn("sitemap: published listing lookup failed", { error });
    }
  } else {
    logger.warn("sitemap: URL limit reached before listing URLs could be added", { limit: MAX_SITEMAP_URLS });
  }

  const urls = [...paths].slice(0, MAX_SITEMAP_URLS)
    .map((path) => `  <url><loc>${escapeXml(origin + path)}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
