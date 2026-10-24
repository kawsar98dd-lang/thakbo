import { isbot } from "isbot";
import { execute, queryAll, queryFirst } from "~/server/db/client";
import { logger } from "~/server/logger.server";

const COOKIE_NAME = "thakbo_analytics_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const DEDUP_RETENTION_DAYS = 35;

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") ?? "";
  for (const item of raw.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) {
      const candidate = value.join("=");
      return /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : null;
    }
  }
  return null;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Records one page/listing view per anonymous browser, page and UTC day. Failure never breaks public pages. */
export async function trackPageView(db: D1Database, request: Request, pageKey: string, pageType: "page" | "listing", listingId: string | null = null): Promise<Headers> {
  const headers = new Headers();
  const userAgent = request.headers.get("user-agent") ?? "";
  // Respect common privacy signals. Do not set or read the analytics cookie when opted out.
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return headers;
  if (isbot(userAgent) || pageKey.length > 180 || (pageType === "listing" && !listingId)) return headers;

  let visitorId = readCookie(request, COOKIE_NAME);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    headers.append("Set-Cookie", `${COOKIE_NAME}=${visitorId}; Max-Age=${COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  }

  const day = utcDay();
  try {
    const visitorHash = await sha256(visitorId);
    const inserted = await execute(db,
      "INSERT OR IGNORE INTO analytics_view_dedup (day, page_key, visitor_hash) VALUES (?, ?, ?)",
      [day, pageKey, visitorHash]);
    if (inserted.meta.changes > 0) {
      await execute(db,
        `INSERT INTO analytics_daily_views (day, page_key, page_type, listing_id, view_count)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(day, page_key) DO UPDATE SET view_count = view_count + 1`,
        [day, pageKey, pageType, listingId]);
    }
    // Low-frequency cleanup keeps the deduplication table bounded without a cleanup write on every request.
    if (Math.random() < 0.002) {
      const cutoff = new Date(Date.now() - DEDUP_RETENTION_DAYS * 86400000).toISOString();
      await execute(db, "DELETE FROM analytics_view_dedup WHERE created_at < ?", [cutoff]);
    }
  } catch (error) {
    // Analytics must never take down the home/listing experience, including before migration is applied.
    logger.warn("analytics view tracking unavailable", { error });
  }
  return headers;
}

export async function getPublicAnalytics(db: D1Database) {
  try {
    const row = await queryFirst<{ totalPageViews: number; totalListingViews: number; todayPageViews: number; publishedListings: number }>(db,
      `SELECT
        COALESCE((SELECT SUM(view_count) FROM analytics_daily_views WHERE page_type IN ('page','listing')), 0) AS totalPageViews,
        COALESCE((SELECT SUM(view_count) FROM analytics_daily_views WHERE page_type = 'listing'), 0) AS totalListingViews,
        COALESCE((SELECT SUM(view_count) FROM analytics_daily_views WHERE day = ?), 0) AS todayPageViews,
        (SELECT COUNT(*) FROM listings WHERE status = 'published') AS publishedListings`, [utcDay()]);
    return row ?? { totalPageViews: 0, totalListingViews: 0, todayPageViews: 0, publishedListings: 0 };
  } catch (error) {
    logger.warn("public analytics summary unavailable", { error });
    return { totalPageViews: 0, totalListingViews: 0, todayPageViews: 0, publishedListings: 0 };
  }
}

export async function getListingViewCount(db: D1Database, listingId: string): Promise<number> {
  try {
    const row = await queryFirst<{ total: number }>(db,
      "SELECT COALESCE(SUM(view_count), 0) AS total FROM analytics_daily_views WHERE page_type = 'listing' AND listing_id = ?", [listingId]);
    return row?.total ?? 0;
  } catch (error) {
    logger.warn("listing analytics unavailable", { error });
    return 0;
  }
}

export async function getAdminAnalytics(db: D1Database) {
  const summary = await queryFirst<{ allViews: number; listingViews: number; todayViews: number; last7Days: number; last30Days: number }>(db,
    `SELECT
      COALESCE(SUM(view_count), 0) AS allViews,
      COALESCE(SUM(CASE WHEN page_type = 'listing' THEN view_count ELSE 0 END), 0) AS listingViews,
      COALESCE(SUM(CASE WHEN day = ? THEN view_count ELSE 0 END), 0) AS todayViews,
      COALESCE(SUM(CASE WHEN day >= ? THEN view_count ELSE 0 END), 0) AS last7Days,
      COALESCE(SUM(CASE WHEN day >= ? THEN view_count ELSE 0 END), 0) AS last30Days
     FROM analytics_daily_views`, [utcDay(), utcDay(new Date(Date.now() - 6 * 86400000)), utcDay(new Date(Date.now() - 29 * 86400000))]);
  const popularListings = await queryAll<{ listingId: string; title: string; slug: string; views: number }>(db,
    `SELECT a.listing_id AS listingId, COALESCE(l.title, 'Unavailable listing') AS title, COALESCE(l.slug, '') AS slug,
            SUM(a.view_count) AS views
     FROM analytics_daily_views a LEFT JOIN listings l ON l.id = a.listing_id
     WHERE a.page_type = 'listing' AND a.listing_id IS NOT NULL
     GROUP BY a.listing_id, l.title, l.slug
     ORDER BY views DESC, title ASC LIMIT 20`);
  const dailyViews = await queryAll<{ day: string; views: number; listingViews: number }>(db,
    `SELECT day, SUM(view_count) AS views,
      SUM(CASE WHEN page_type = 'listing' THEN view_count ELSE 0 END) AS listingViews
     FROM analytics_daily_views WHERE day >= ? GROUP BY day ORDER BY day ASC`,
    [utcDay(new Date(Date.now() - 29 * 86400000))]);
  return { summary: summary ?? { allViews: 0, listingViews: 0, todayViews: 0, last7Days: 0, last30Days: 0 }, popularListings, dailyViews };
}
