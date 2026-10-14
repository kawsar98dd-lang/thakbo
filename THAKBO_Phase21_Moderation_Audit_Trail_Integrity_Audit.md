# THAKBO Phase 21 — Moderation Audit-Trail Integrity Audit

## Scope
Read-only audit of migration `0008_listing_moderation.sql`, moderation repository code, and the existing moderation database/service tests. No application or migration code was changed in this phase.

## Findings from source inspection

### Finding 1 — History rows are not actually append-only
The migration comment describes `listing_moderation_events` as an append-only history table, but migration `0008_listing_moderation.sql` defines no `BEFORE UPDATE` or `BEFORE DELETE` trigger on that table. The current schema therefore permits a database writer with direct SQL access to update or delete history rows. The existing tests verify that status changes generate history, but do not establish immutability of existing event rows.

**Risk:** history can be altered by a code path that has database write access, weakening the audit trail.

### Finding 2 — Physical listing deletion cascades to its history
`listing_moderation_events.listing_id` references `listings(id) ON DELETE CASCADE`. A physical deletion of a listing therefore removes its associated moderation events. The application appears to use a `deleted` status for normal listing deletion, but the schema itself does not retain events if a listing row is physically deleted.

**Risk:** history retention depends on all deletion paths continuing to use soft deletion.

## Why this phase does not silently patch the migration
Making event rows immutable while the foreign key uses `ON DELETE CASCADE` requires a deliberate retention policy: a delete-blocking trigger on events can also interfere with cascading listing deletion. Changing this safely may require a migration and a documented choice between restricting physical listing deletion, preserving orphaned audit records, or explicitly authorizing a purge path. This phase records the issue instead of introducing an untested schema change.

## Recommended next phase
Design and implement an additive migration for audit-event immutability and a clear physical-listing-deletion retention policy, with regression tests for direct event UPDATE/DELETE, status-transition event creation, foreign-key behavior, and migration compatibility.

## Verification status
- Source inspection: completed for the files listed above.
- Runtime tests, typecheck, lint, build, and GitHub CI: not run in this workspace.
- This is an audit report, not a claim that the identified issues have been fixed.
