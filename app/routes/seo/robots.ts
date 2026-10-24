import { SITE } from "~/lib/constants";

/**
 * Robots directives guide crawlers but do not provide access control.
 * Account and admin routes may need to be crawled to discover their `noindex`
 * metadata; authorization and noindex metadata remain the actual protections.
 */
export function loader() {
  const origin = SITE.canonicalOrigin;
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
