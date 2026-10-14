# THAKBO Phase 24 — Database Migration Readiness Report

## Scope
This phase hardens the repository's existing offline SQL verification script. It does not apply migrations to a live Cloudflare D1 database and does not replace GitHub Actions validation.

## Changes
- `scripts/verify-sql.py` now validates migration filenames against `NNNN_description.sql`.
- It fails early if migration numbering does not start at `0000`, contains a duplicate/gap, or is not in the expected contiguous sequence.
- It verifies that the three audit-retention triggers introduced by migration `0010_moderation_audit_retention.sql` exist after all migrations are applied.
- Existing checks remain: apply every migration using Python's SQLite engine, apply seeds twice, compare seed row counts, and run `PRAGMA foreign_key_check`.

## Validation evidence
- Static inspection: migration files currently run from `0000_better_auth.sql` through `0010_moderation_audit_retention.sql` with no visible numbering gaps.
- Python SQL verifier: `python3 scripts/verify-sql.py` completed successfully. It applied migrations 0000–0010, confirmed all three audit-retention triggers exist, applied both seed files twice with identical row counts `(1, 1, 10, 25, 22)`, and found no foreign-key violations. `python3 -m py_compile scripts/verify-sql.py` also completed successfully.
- ZIP integrity: checked separately after packaging.
- Vitest, TypeScript type-check, ESLint, production build, GitHub Actions, and live Cloudflare D1 migration were not represented as passed unless separately executed and evidenced.

## Production cautions
- A local SQLite pass is not proof that a remote D1 migration has been applied.
- Do not manually delete or edit migration files already applied to a shared/production database; add a new numbered migration instead.
- Before production rollout, confirm the target D1 database binding/ID, inspect the Cloudflare migration history, take an appropriate backup/export, and apply through the intended deployment process.
