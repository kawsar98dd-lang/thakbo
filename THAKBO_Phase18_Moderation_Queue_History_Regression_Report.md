# THAKBO Phase 18 — Moderation Queue & History Regression Coverage

## Scope
This phase continues from the Phase 17 source tree and changes only `tests/moderation-service.test.ts` plus this report. No application runtime code, database migration, environment variable, or secret was changed.

## Added regression cases
- Unsupported moderation queue statuses (`draft`, `deleted`) return no results.
- Queue result limits are respected, including a zero limit.
- Listings with the same submission timestamp use listing ID as a deterministic tie-breaker.
- Moderation history is returned newest-first and respects the requested limit.

## Verification status
- Source-level inspection: performed for the moderation service, repository, and existing moderation tests.
- ZIP archive integrity: checked after packaging.
- Vitest, TypeScript typecheck, ESLint, production build, and GitHub Actions CI: **not run in this environment**. These tests are added regression coverage, not a claim that they have passed.
- Deployment: not performed; the live site is unchanged by this ZIP until the user uploads/deploys it.

## Upload note
Upload the contents of the ZIP's `thakbo-main/` folder into the repository using the same process as prior phases. Run GitHub CI before deployment and share any failing log for follow-up.
