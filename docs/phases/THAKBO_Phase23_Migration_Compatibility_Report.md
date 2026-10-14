# THAKBO Phase 23 — Migration Compatibility Regression

## Scope
- Added a regression test that creates a database stopped immediately before migration `0010` (after prior migrations, including `0009`).
- Inserts a listing and moderation events using the existing test helpers, then applies `0010_moderation_audit_retention.sql` to that pre-existing database.
- Asserts listing status and existing event count survive, foreign-key checks remain clean, and the newly installed immutability trigger rejects an event update.

## Files changed
- `tests/moderation-database.test.ts`
- `THAKBO_Phase23_Migration_Compatibility_Report.md`

## Verification status
- Source inspection and patch creation: completed.
- ZIP integrity: checked after packaging.
- Vitest, TypeScript typecheck, ESLint, production build, and GitHub CI: not run in this workspace. The new regression test is not claimed to pass until executed.

## Important limitation
This is a migration compatibility regression test, not proof of a live Cloudflare D1 remote migration. Apply the migration to a staging database and review its backup/rollback plan before production use.
