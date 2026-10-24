# THAKBO SEO Domain Launch Update — 2026-10-24

## Goal
Prepare the existing THAKBO project for the intended public launch domain `https://thakbo.eu.cc/`, improve Bengali search relevance, and preserve the current application architecture and functional flows.

## Source changes
- Updated `SITE.canonicalOrigin` to `https://thakbo.eu.cc` (single source of truth for canonical URLs, `og:url`, sitemap, robots sitemap declaration, listing social image URLs and breadcrumb JSON-LD).
- Updated the shared site description to explain the service in Bengali and English.
- Added a bilingual homepage title and Bengali homepage meta description source.
- Added a short visible Bengali sentence to the existing hero without replacing the current English H1 or changing the search UI.
- Added safe `WebSite` JSON-LD to the homepage using the existing JSON-LD serializer.
- Added Open Graph locale metadata for Bengali (Bangladesh) and English (Bangladesh).
- Improved city/area metadata with natural Bengali rental-search wording and location names.
- Improved public listing descriptions with property type, area, city, monthly rent and availability, including Bengali wording.
- Updated SEO regression test expectations for the new canonical origin and bilingual metadata.
- Updated the current README domain guidance and included an updated Bengali SEO master checklist.
- Removed a duplicate identical homepage H2 if present in the audited source; the rendered heading remains once.

## Preserved
No database migrations, database IDs, authentication logic, listing lifecycle, admin authorization, R2/D1 bindings, route structure, or existing visual components were intentionally changed. The homepage change is limited to SEO text/metadata/structured data and removal of a duplicate heading.

## Static checks performed
- Confirmed source no longer references the old Workers hostname in active app/test/README configuration files.
- Confirmed the SEO canonical origin is configured as `https://thakbo.eu.cc`.
- Confirmed sitemap and robots handlers consume `SITE.canonicalOrigin`, so they follow the configured origin.
- Confirmed sitemap queries are already restricted to published listings and locations with published listings.
- Confirmed homepage JSON-LD uses the existing safe serializer.
- Confirmed ZIP packaging and SHA-256 after final packaging.

## Not run / not claimed
- Full `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` were not run. The environment Node.js version is 22.16.0, while `package.json` requires Node.js >=22.22.0, and project dependencies are not installed here.
- No Cloudflare Preview or Production deployment was performed.
- No live DNS/SSL/custom-domain, Better Auth callback, Google Search Console, sitemap fetch, crawler rendering, Core Web Vitals or ranking verification was performed.

## Before Production deployment
1. Use Node.js >=22.22.0 and run the complete CI workflow.
2. Verify Cloudflare custom domain/DNS/HTTPS for `thakbo.eu.cc`.
3. Check `BETTER_AUTH_URL` / trusted origins / reset-password callback settings in the production environment.
4. Inspect `/`, `/robots.txt`, `/sitemap.xml`, one public city/area page and one published listing on Preview.
5. Confirm Search Console property and submit `https://thakbo.eu.cc/sitemap.xml` after the domain is live.
6. Run regression checks for login, listing submit/moderation, search, reports, contact, image upload and password reset.

SEO improvements support discoverability but cannot guarantee a particular Google ranking or timeline.
