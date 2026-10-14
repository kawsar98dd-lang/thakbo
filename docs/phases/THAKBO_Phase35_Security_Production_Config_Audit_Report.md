# THAKBO Phase 35 — Security & Production Configuration Audit

## Scope
Read-only repository review of `wrangler.jsonc`, `.gitignore`, the CI workflow, and the manually triggered production D1 workflow. Added a static checker and offline regression tests, and wired both into CI. No Cloudflare account was accessed and no deployment, database, or object-storage resource was changed.

## Changes
- Added `scripts/check-security-config.py`.
  - Flags secret-looking non-empty values in committed Wrangler `vars` and Preview `vars`.
  - Reuses the Preview configuration audit to block shared production/Preview D1 or R2 resources and other Preview blockers.
  - Checks that local environment/dev-vars files are ignored by Git.
  - Checks that the production D1 workflow is manual-only, requires the `THAKBO-DB` confirmation for apply, and does not cancel an in-progress run.
  - Reports least-privilege CI workflow permissions and clearly labels checks requiring account access as manual.
- Added `scripts/check-security-config-test.py` with four offline tests, including negative cases for a secret in plain vars, a shared Preview R2 bucket, and missing environment-file ignore rules.
- Added the strict audit and its tests to `.github/workflows/ci.yml` before the production database tooling tests.

## Validation actually run
- `python3 scripts/verify-sql.py` — passed; all 11 migrations applied in SQLite, expected audit-retention triggers were present, two seed runs produced matching counts, and no foreign-key errors were reported.
- `python3 scripts/production_db_test.py` — 49 tests passed.
- `python3 scripts/check-preview-config-test.py` — 7 tests passed.
- `python3 scripts/storage_tools_test.py` — 6 tests passed.
- `python3 scripts/check-security-config-test.py` — 4 tests passed.
- `python3 -m py_compile scripts/check-security-config.py scripts/check-security-config-test.py` — passed.
- `python3 scripts/check-security-config.py --strict` — exit 0, 0 repository-config blockers.
- `python3 scripts/check-preview-config.py` — completed; this is read-only and does not contact Cloudflare.

## Important limitations / manual checks
- This does **not** prove the live Cloudflare account has the intended resources or that deployed secrets are set correctly.
- Confirm GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, plus Cloudflare `BETTER_AUTH_SECRET` (and `BETTER_AUTH_URL` if needed) in their respective secret stores. Secret values are not read or printed by these scripts.
- Confirm Preview D1/R2 resources exist and remain separate from production in Cloudflare.
- Node dependency installation, TypeScript, ESLint, Vitest, and production build were not run in this environment. The repository's GitHub Actions CI result remains authoritative for those checks.
- The production D1 workflow is intentionally manual and still requires its explicit confirmation; do not run `apply` until the target account/database and backup/recovery expectations have been reviewed.

## Outcome
Static repository security/configuration checks report **0 blockers**. There are still account-level manual checks, and full application CI is not yet proven green.
