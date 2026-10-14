# THAKBO — Phase 2 SEO Update Report

Date: 14 October 2026

## Scope

This phase builds on `THAKBO_PHASE1_SEO_SITEMAP_UPDATE.zip`. It changes SEO canonical handling, public location pages, sitemap location eligibility, robots directives, and listing social metadata. It does not deploy or modify GitHub.

## Changes

- Added `SITE.canonicalOrigin` in `app/lib/constants.ts`, currently set to the live address documented in the project handoff: `https://thakbo.kawsar98dd.workers.dev`.
- Canonical links, `og:url`, `robots.txt`, and `sitemap.xml` now use that same configured production origin instead of whichever request hostname happened to be used (such as a preview host).
- City and area pages now show real published listing cards, navigation between city/area pages, and useful page copy instead of the old “arrive in Milestones 4 and 5” placeholder.
- City/area pages with no published listing receive `noindex, follow` metadata.
- Sitemap location URLs are included only for active cities/areas with at least one published listing. Published listing URLs remain included; non-published statuses remain excluded.
- `robots.txt` no longer disallows dashboard/admin/login/register paths. This lets crawlers follow redirects and observe page-level `noindex` directives where available. `/api/` remains disallowed. Robots rules are not access control.
- Listing pages now create more specific meta descriptions using property type, location, monthly rent, and availability. When a published listing has a cover photo, Open Graph and Twitter large-image metadata point to the public image route.
- Added regression tests for canonical origin, robots sitemap/crawl policy, social image metadata, and sitemap location eligibility.

## Checks actually run

- `python3 scripts/verify-sql.py` — PASS (migrations 0000–0008; idempotent seeds; foreign-key check; 21 tables).
- `python3 scripts/check-preview-config-test.py` — PASS (7 tests).
- `python3 scripts/production_db_test.py` — PASS (48 tests; offline tooling tests, not a live Cloudflare D1 test).
- `python3 scripts/check-preview-config.py --strict` — exit 0, zero blockers; existing warnings remain about production D1 ID, real R2 resource existence, and Cloudflare preview secrets.
- TypeScript `transpileModule` syntax checks for all 11 changed TypeScript/TSX files — PASS. This checks syntax only, not type correctness.
- SQLite smoke test of the sitemap location SQL — PASS; a published listing adds its city/area and pausing it removes those location URLs.
- ZIP integrity test — PASS after packaging.

## Not verified

- Full `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` could not be completed. `npm ci` stalled while attempting to fetch packages in this environment and was stopped; no successful dependency install occurred.
- No live Cloudflare Worker/D1/R2 test, browser rendering test, Google crawler test, or Search Console verification was performed.
- The canonical origin is based on the live address recorded in the project handoff. If a custom domain is configured as the intended public domain, change `SITE.canonicalOrigin` before deployment.

## Files changed in this phase

- `app/lib/constants.ts`
- `app/lib/seo.ts`
- `app/root.tsx`
- `app/routes/area.tsx`
- `app/routes/city.tsx`
- `app/routes/listing.tsx`
- `app/routes/seo/robots.ts`
- `app/routes/seo/sitemap.ts`
- `app/server/db/repositories/locations.ts`
- `tests/listing-repository.test.ts`
- `tests/routes-seo.test.ts`
- `README.md`

No production database was changed. No deployment, push, merge, or branch operation was performed.
