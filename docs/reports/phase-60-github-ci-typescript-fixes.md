# THAKBO Phase 60 — GitHub CI TypeScript Error Fixes

## Source of the fixes
The changes are based on the GitHub Actions screenshot provided by the project owner. The screenshot shows TypeScript errors in `app/routes/dashboard/listings.tsx` and `app/routes/listing.tsx`.

## Changes
1. `app/components/ui/Alert.tsx`: added the `warning` tone to the Alert type and styling because the dashboard uses `<Alert tone="warning">` for freshness reminders.
2. `app/server/db/repositories/listings.ts`: added `getPublishedListingIdBySlug`, a server-side helper to retrieve a published listing's internal ID.
3. `app/routes/listing.tsx`: uses that internal ID for analytics tracking and view counts, while keeping it out of the public listing object/loader response. Analytics page key uses the slug.

## Security / behavior notes
- Public `ListingDetail` still does not contain an internal database ID.
- Favorite, report, and owner checks remain slug-based.
- No database migration, schema, secret, Cloudflare resource, or deployment was changed.

## Verification
- `python3 scripts/verify-ci-workflow.py`: PASS (static workflow consistency check only).
- `python3 scripts/verify-sql.py`: PASS (offline SQLite migration/seed verification).
- Full TypeScript, ESLint, Vitest and production build were NOT run in this environment because `node_modules` is absent and dependencies are not available locally. The GitHub Actions workflow must be rerun to confirm the reported errors are resolved.
