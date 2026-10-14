# THAKBO Phase 20 — Moderation Pagination Limit Safety

## Scope
- Hardened moderation queue and moderation-history repository limits.
- Added regression coverage for negative and non-finite limit inputs.

## Change
SQLite treats a negative `LIMIT` as unlimited. The moderation repositories now normalize limits to finite, non-negative integers and cap positive values at 100. A normalized zero returns an empty list without querying. Non-finite inputs use the repository's documented default (100 for queue, 50 for history).

## Files changed
- `app/server/db/repositories/moderation.ts`
- `tests/moderation-service.test.ts`
- This report

## Verification
- ZIP archive integrity: to be checked after packaging.
- Vitest, TypeScript typecheck, ESLint, production build, and GitHub CI: not run in this workspace. The new tests have not been executed here.

