# THAKBO Phase 19 — Admin Moderation Revocation Regression Report

## Scope
This phase adds focused regression coverage for the security boundary between the `admin_users` role registry and listing moderation. It is based on the Phase 18 project tree.

## Changes
- `tests/moderation-service.test.ts`: added a test that revoking an administrator's or moderator's role prevents subsequent service-level approval/rejection and leaves the listing pending without approval/rejection history events.
- `tests/moderation-database.test.ts`: added a database-trigger regression test that a previously registered reviewer cannot directly approve after their moderator role is revoked; the listing remains pending and no approval event is written.
- No application runtime code, schema, migration, or environment configuration was changed.

## Verification status
- ZIP integrity: checked after packaging.
- Test suite: **not run** in this environment.
- TypeScript typecheck, lint, production build, and GitHub Actions CI: **not run**.
- These tests are proposed regression coverage; their passing status is unverified until run in the project's test environment/GitHub CI.

## SHA-256
See the adjacent `.sha256` file and the handoff message for the archive checksum.
