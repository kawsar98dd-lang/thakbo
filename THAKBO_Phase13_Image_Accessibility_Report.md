# THAKBO Phase 13 — Remaining image-loading polish

## Changes
- Added `decoding="async"` to listing images in the listing image manager, where owners/admins review uploaded photos.
- Added `decoding="async"` to listing photos shown in the admin listing-review screen.
- Preserved existing lazy-loading behavior, image URLs, access controls, and image alt text.
- No database schema, environment variables, routing, or authorization behavior changed.

## Verification
- ZIP integrity was checked after packaging.
- Source inspection confirmed the two intended image elements include asynchronous decoding.
- Full npm typecheck, lint, automated tests, production build, GitHub Actions CI, and live deployment were not run in this workspace. Treat this phase as unverified until GitHub CI is run.
