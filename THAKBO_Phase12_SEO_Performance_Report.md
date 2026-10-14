# THAKBO Phase 12 — SEO and image-loading improvements

## Changes made
- Added a page-level `robots` directive for dashboard, admin, and authentication routes so these private/account surfaces are not intended for indexing.
- Kept `robots.txt` focused on disallowing API endpoints and preserved the sitemap declaration. Private/account pages use an HTML `noindex` directive instead, allowing crawlers to see that directive.
- Added asynchronous image decoding hints to listing-card images.
- Added asynchronous image decoding hints to listing-detail photos and high fetch priority for the first (lead) photo; later gallery photos remain lazy-loaded.
- Preserved existing canonical URL logic, sitemap generation, and public listing/city/area metadata.

## Important limitations
- `robots.txt` is a crawler directive, not an access-control mechanism. Existing server-side authentication/authorization remains essential.
- The `noindex` directive is an indexing hint, not an access-control mechanism. Private routes remain protected by server-side route middleware.
- No production deployment or live crawler verification was performed.
- Dependency installation is not available in this workspace, so the full npm typecheck/lint/test/build and GitHub Actions CI were not run for this ZIP. Do not treat this phase as CI-verified until you upload it and GitHub Actions passes.
