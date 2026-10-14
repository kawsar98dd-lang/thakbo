# THAKBO Phase 6 — Report Abuse Protection

## Scope

This phase adds a server-side daily submission cap to the existing signed-in listing-report flow. It is a small abuse-prevention guard and does not require a database migration.

## Changes

- `app/server/db/repositories/engagement.ts`: report creation now only inserts when the reporter has submitted fewer than 10 reports in the previous rolling 24 hours. The existing requirements remain: listing must be published, reporter cannot own it, and the reporter cannot already have a pending report for that listing.
- `app/routes/listing.tsx`: the failure message now explains that the daily report limit may have been reached.
- `tests/engagement.test.ts`: added a regression test for the 10-report rolling 24-hour limit.

## Verification

- `python3 scripts/verify-sql.py` — PASS; migrations 0000–0008 and seed idempotency checked.
- `python3 scripts/check-preview-config-test.py` — PASS; 7 tests.
- `python3 scripts/production_db_test.py` — PASS; 48 tests.
- Python compile checks for project Python scripts — PASS.
- Independent SQLite smoke test of the report-insert predicate — PASS; 10 recent reports blocked, 9 recent reports allowed.
- ZIP integrity — checked after packaging.

## Not verified

- Vitest regression suite, TypeScript type-check, ESLint, and production build were not run because `node_modules` is absent and dependencies could not be verified/installed in this environment.
- No live Cloudflare D1/R2, deployed-site, or production configuration test was run.
- No GitHub push/merge or Cloudflare deployment was performed.

## Behavior note

The limit is 10 reports per reporter in a rolling 24-hour window. It counts reports in all statuses (pending, reviewed, resolved, dismissed) to prevent repeatedly submitting and then resolving/dismissing reports to bypass the cap. A report denied by the guard currently uses the existing generic conflict response; the UI text mentions the daily cap as one possible reason.
