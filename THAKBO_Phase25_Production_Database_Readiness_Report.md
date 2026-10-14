# THAKBO Phase 25 — Production Database & Deployment Readiness Audit

## Scope
Reviewed the repository's production D1 initialization tool, its manual-only GitHub Actions workflow, Wrangler D1 migration list, SQLite migration/seed verifier, and offline production-tool tests.

## Finding fixed
The repository now contains migration `0010_moderation_audit_retention.sql`, but `scripts/production_db.py` still listed only migrations `0000`–`0009` in `EXPECTED_MIGRATIONS`. That mismatch meant the production database preflight would refuse to proceed even when the repository's migration files were otherwise valid. The production tool's expected migration list now includes `0010_moderation_audit_retention.sql`.

## Production verification strengthened
- Added `listing_moderation_events` to the required production tables.
- The production verification step now checks that all three migration-0010 retention triggers exist in the live schema:
  - `trg_listing_moderation_events_no_update`
  - `trg_listing_moderation_events_no_delete`
  - `trg_listings_audit_retention_guard`
- Verification fails with an explicit error if a required retention trigger is missing, rather than relying only on the `d1_migrations` ledger.
- Updated the offline production database tests for the additional migration and added a regression test proving verification rejects a database missing one of the retention triggers.

## Checks actually run
- `python3 scripts/production_db_test.py` — **PASS**, 49 tests.
- `python3 scripts/verify-sql.py` — **PASS**; all 11 migrations applied to a local SQLite test database, all three audit-retention triggers found, seeds run twice with identical counts `(countries/cities/areas/aliases/facilities = 1/1/10/25/22)`, and no SQL verification failure.
- `python3 scripts/check-preview-config.py` — completed; reports **0 blockers**, with warnings/manual checks still noted for production D1 ID, Preview R2 existence, and Preview secrets.
- Full Node/npm CI (`typecheck`, lint, Vitest, production build) — **not run in this environment**.
- Live Cloudflare D1 and Worker deployment — **not run**. No production secrets or live database were accessed.

## Remaining deployment risks / manual checks
1. `wrangler.jsonc` intentionally does not pin the production `database_id`; the initialization tool resolves the existing D1 database by exact name. Confirm the Cloudflare account and token point to the intended account before running production `apply`.
2. The Preview R2 bucket's existence and Preview secrets cannot be verified from this repository alone.
3. GitHub Actions must still pass after uploading this ZIP. A local Python verification does not prove the full Node build or remote Cloudflare behavior.
4. Do not run the manual production workflow in `apply` mode until its `check` mode has been reviewed and the target database is confirmed.

## Files changed
- `scripts/production_db.py`
- `scripts/production_db_test.py`
- `THAKBO_Phase25_Production_Database_Readiness_Report.md`
