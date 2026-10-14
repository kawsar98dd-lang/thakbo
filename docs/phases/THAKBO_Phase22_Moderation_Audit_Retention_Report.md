# THAKBO Phase 22 — Moderation Audit Retention

## Changes
- Added additive migration `0010_moderation_audit_retention.sql`.
- Added SQLite triggers that reject UPDATE and DELETE operations on `listing_moderation_events`.
- Added a listing-delete guard: if a listing has moderation events, physical deletion is rejected and the existing `deleted` status transition must be used instead.
- Added database regression tests for direct event mutation/deletion, physical listing deletion, and retention of history during soft deletion.

## Retention policy
Moderation events are retained with their listing. Normal deletion is a status transition to `deleted`; physical deletion of a listing with history is blocked. This is intentionally conservative and may require a separately designed, explicitly authorized retention/purge procedure if legal or operational requirements later demand permanent erasure.

## Verification status
- Source edits: completed.
- ZIP archive integrity: checked when packaging.
- Vitest, typecheck, lint, production build, and GitHub CI: not run in this workspace. The added tests are not claimed to have passed.
