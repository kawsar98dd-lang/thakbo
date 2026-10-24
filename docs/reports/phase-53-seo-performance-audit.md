# Phase 53 — SEO & Performance Audit

## Scope
This phase makes a conservative robots.txt improvement. It does not change canonical URL generation, sitemap URL selection, listing metadata, database schema, or public UI.

## Change
- `app/routes/seo/robots.ts` now disallows crawling of API, admin, dashboard, authentication and logout paths.
- Sitemap declaration continues to use `SITE.canonicalOrigin`.
- A code comment clarifies that robots.txt is not an access-control mechanism; authorization must remain enforced by routes/middleware.

## Existing SEO behavior reviewed
- `app/root.tsx` emits a single canonical link and `og:url` based on the pathname, excluding query strings.
- `app/lib/seo.ts` provides titles/descriptions/Open Graph metadata and optional `noindex` metadata.
- `app/routes/seo/sitemap.ts` includes static public pages, active city/area pages and published listing URLs, while excluding search-filter URLs and unpublished listings.
- `SITE.canonicalOrigin` currently points to `https://thakbo.eu.cc`. If the production domain changes, this single constant must be updated and verified before deployment.

## Important limitation
Robots.txt directives are voluntary crawler guidance, not privacy/security controls. Private pages must continue to require server-side authentication/authorization. The existing root layout also adds `noindex` for account/admin paths.

## Validation status
- Source review: completed for the files listed above.
- Full TypeScript, ESLint, Vitest and production build: not run in this environment; perform during the planned final CI pass.
- Live Google Search Console, live headers, canonical tags, sitemap fetch and Lighthouse/PageSpeed: not verified in this phase.
- No GitHub push, Cloudflare deployment, or production database change performed.
