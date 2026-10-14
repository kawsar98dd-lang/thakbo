# THAKBO Phase 30 — Storage Failure Recovery & Retry Readiness

## Scope
This phase focuses on compensating failures in listing-image upload/delete flows. It does not change production data, contact Cloudflare, or add automatic deletion/retry behavior.

## Changes
- Added `objectKey` to the structured warning emitted when the service cannot remove an unreferenced R2 object. This gives operators a concrete key to reconcile without logging image bytes or user-provided filenames.
- Added a regression test for the double-failure case: R2 upload succeeds, D1 rejects the image row, and the compensating R2 delete fails. The expected result is an error response, no D1 image row, and an orphaned R2 object in the fake bucket.
- Kept retry/deletion manual. Automatic retries need a durable queue or reconciliation workflow with idempotency, bounded retries, and alerting; logging alone does not guarantee recovery.

## Verification status
- Source changes were inspected locally.
- The test was added but Vitest was not run in this environment; dependencies are not installed in this worktree.
- No TypeScript check, lint, full test suite, build, GitHub Actions run, or live Cloudflare D1/R2 operation was performed.
- ZIP archive integrity was checked after packaging.

## Operational guidance
1. Review structured logs for `could not remove an unreferenced image file` and its `objectKey`.
2. Before any cleanup, export a fresh D1 image-key inventory and compare against R2 inventory.
3. Re-check that the candidate is not referenced in D1 immediately before deletion.
4. Use the Phase 29 dry-run planner first; do not turn candidate reports directly into bulk deletion commands.
5. For durable recovery, design a D1-backed cleanup/outbox table with unique object keys, attempt count, next-attempt time, last error, and terminal/manual-review status. Add it only after a separate migration and failure-mode review.
