# THAKBO SEO Phase 45 — Bengali On-page Content & Metadata

Date: 2026-10-24
Target canonical origin: https://thakbo.eu.cc
Base: THAKBO_SEO_Domain_Launch_Upgrade.zip

## Objective
Continue the SEO work with restrained, content-led improvements for Bangladesh users while preserving the current UI structure, routes, authentication, listing workflow, database schema, and Cloudflare bindings.

## Changes in this phase
- Improved the About page title/description for Bengali search intent and added a concise Bengali paragraph describing the actual user journeys (search accommodation and submit a listing).
- Improved the How it works page title/description and added a Bengali step-by-step section below the existing English instructions. Existing English content and page layout remain in place.
- Improved city and area page title/description wording so location names appear naturally with Bengali rental-search terms; added Bengali support text alongside existing English location descriptions.
- Improved public listing page title to include the listing's real area and city as well as its title; the existing description continues to use the actual property type, area, city, rent and availability fields.
- Improved Contact page metadata in Bengali and English.
- Updated this SEO Master Plan and recorded the phase report inside `docs/reports/` for future continuation.

## Deliberately not changed
- No database migration or schema change.
- No authentication, authorization, listing moderation, reports, uploads, contact form action, D1/R2 binding, or route changes.
- No generated city/area pages, fake listings, fake ratings, fake reviews, or unsupported claims.
- No `hreflang` tags added because the project does not currently provide separate, equivalent translated URL versions for every page.
- No legal text rewrite; Privacy and Terms pages still need proper legal content before launch and must not be treated as complete legal documents.

## Verification performed
- Reviewed the changed route files and metadata logic statically.
- TypeScript `transpileModule` syntax checks passed for all six changed `.tsx` route files (syntax only, not full type-check).
- Existing SQL migration/seed verification script passed: 11 migrations applied in the temporary SQLite engine, 22 tables found, and seed counts were stable on a second run.
- Checked that the project still uses the configured canonical origin `https://thakbo.eu.cc`.
- Checked that the existing SEO tests cover canonical origin, robots sitemap declaration, noindex handling, and safe JSON-LD serialization.
- Packaged the full source tree and computed a SHA-256 checksum for the output ZIP.

## Not run / not claimed
- Full npm install, TypeScript typecheck, ESLint, Vitest suite, production build, Worker dry-run, Cloudflare Preview/Production deployment, browser rendering, Search Console, Core Web Vitals, or ranking verification were not run in this environment. Node.js available here is 22.16.0, below the project's declared >=22.22.0 requirement.
- The static review is not a guarantee that all CI checks pass or that the live site is unaffected. Run the GitHub Actions CI and deploy to Preview before Production.

## Next steps
1. Run the full CI workflow with Node.js >=22.22.0 and the project's prescribed npm version.
2. Deploy to Cloudflare Preview and check homepage, city/area page, one published listing, robots.txt and sitemap.xml.
3. Regression-test login, password reset, listing submit/moderation, search, contact, reports, uploads and admin authorization.
4. Verify `https://thakbo.eu.cc/` DNS/HTTPS and production auth callback settings before launch.
5. Verify the Search Console property and submit `https://thakbo.eu.cc/sitemap.xml` after the target domain is live.

SEO supports discoverability but does not guarantee a specific Google position or timeline.
