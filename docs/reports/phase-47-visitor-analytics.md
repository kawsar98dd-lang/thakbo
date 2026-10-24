# THAKBO Phase 47 — Privacy-conscious Visitor Analytics

**Date:** 2026-10-24  
**Status:** Source review and SQLite/security/workflow tests passed; full Node CI and live Cloudflare verification are still required.

## Goal
Add a long-term, low-cost first-party visitor counter while preserving the existing public UI and admin security boundaries.

## Implemented in source
- Added additive D1 migration `0011_visitor_analytics.sql` with daily aggregate view counts and short-lived deduplication records.
- Added server-side tracking for the homepage and published listing detail pages (not every route in the first release).
- Uses a random, HttpOnly, Secure, SameSite=Lax browser cookie; only a SHA-256 hash is stored for deduplication. Raw IP addresses, account IDs, and request URLs/query strings are not stored by analytics.
- Deduplicates the same browser/page within a UTC day to reduce refresh inflation; automated bots are excluded when detectable using the existing `isbot` dependency.
- Respects `DNT: 1` and `Sec-GPC: 1` privacy signals by skipping tracking and analytics-cookie creation.
- Analytics failures are logged without taking down public home/listing pages.
- Added public homepage statistics and listing detail view counts.
- Added admin-only `/admin/analytics` page with aggregate totals, daily view bars, and most-viewed listings. The route independently calls `requireAdmin`.
- Added admin navigation and a shortcut from the admin overview.
- No existing listing, auth, moderation, image, report, or profile data is intentionally changed by the migration.

## Metrics semantics
- Counts represent recorded homepage/listing-detail browser page views after bot filtering and same-browser/page/day deduplication, not exact human visits.
- “Unique visitors” is intentionally not shown; cookie clearing, browser changes, and bot detection limitations make it an estimate and it is not needed for the first release.
- Public counts use actual stored analytics data and start at zero; no synthetic counters are used.
- Aggregates are retained for historical totals. Deduplication rows are cleaned opportunistically after the 35-day retention window; this is not a guaranteed scheduled cleanup and should be reviewed if traffic becomes substantial.

## Validation completed
- SQLite smoke test: migration SQL executes against a minimal compatible schema; deduplication uniqueness behaves as expected.
- `python3 scripts/verify-sql.py`: passed; all 12 migrations applied to SQLite, seeds remained stable across two runs, and audit-retention triggers were present.
- `python3 scripts/production_db_test.py`: all 49 tests passed after extending the guarded production migration allowlist and required-table checks to include migration 0011.
- `python3 scripts/check-security-config.py --strict`: passed with no blockers; live resource checks remain manual.
- `python3 scripts/check-preview-config-test.py`: 7 tests passed.
- `python3 scripts/check-security-config-test.py`: 4 tests passed.
- Fixed a source-level loader issue discovered during review: listing route now receives the `request` argument required for analytics tracking.
- `scripts/check-preview-config.py`: production D1 ID is still missing from `wrangler.jsonc`; the guarded workflow uses a temporary config, but deployment targeting must be confirmed before release.

## Validation not completed
- `npm ci` timed out in this environment. The runtime is Node 22.16.0 while the project requires 22.22.0. Therefore TypeScript typecheck, ESLint, Vitest suite, and production build have **not** been run here. An initial `npm run check` could not start because the timed-out install left `wrangler` unavailable.
- No migration was applied to production or Preview D1.
- No Cloudflare account, production database, or live website was changed or verified.

## Required release steps
1. Use the repository's supported Node version from `.nvmrc` (22.22.0) and run `npm ci`.
2. Run `npm run check` and resolve any CI/type/lint/test/build errors before deploying.
3. Confirm and back up the intended isolated Preview D1 database; apply migration 0011 to Preview first and verify public counters, DNT/GPC opt-out behavior, listing view counts, and `/admin/analytics`.
4. Verify the real production `thakbo-db` database ID and deployment target; do not guess or copy Preview IDs into production.
5. Back up production D1 and confirm rollback/recovery plan before applying migration 0011 to production.
6. Deploy and test as a non-admin and admin. Do not share secrets in chat.

## Security and privacy notes
This is lightweight first-party analytics, not a security-grade anti-fraud system. Cookie-based deduplication can be bypassed by clearing cookies or switching browsers. Bot filtering is best-effort. No raw IP address is persisted by this implementation. Public endpoints only expose aggregate counts; detailed analytics is guarded by server-side admin authorization.
