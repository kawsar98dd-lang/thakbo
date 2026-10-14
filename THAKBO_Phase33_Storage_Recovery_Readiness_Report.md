# THAKBO Phase 33 — Storage Recovery Readiness

## Scope
Added `scripts/r2-recovery-readiness.py`, a local-only checklist generator that validates the Phase 32 diagnostics JSON and Phase 31 review-queue JSON. It summarizes event counts and requires operator gates before any separate cleanup action.

## Safety guarantees
- Does not connect to Cloudflare, D1, or R2.
- Does not retry operations, approve deletions, or modify storage.
- Rejects unexpected report modes, invalid event counts, queue count mismatches, queue items not marked `NEEDS_MANUAL_REVIEW`, and items that allow automatic deletion.
- Explicitly warns that clean supplied reports do not prove live storage consistency.

## Example

```bash
python3 scripts/r2-recovery-readiness.py \
  --diagnostics storage-diagnostics.json \
  --queue r2-review-queue.json \
  --output storage-recovery-readiness.json
```

The input files must be generated from the earlier scripts. This tool only validates those supplied snapshots; it does not refresh D1/R2 inventories. Any proposed destructive action still requires a fresh live inventory check and explicit human approval.

## Validation status
Phase 29, 31, 32, and 33 Python unit tests and syntax checks were run locally for this phase. The full Vitest, TypeScript, ESLint, production build, and GitHub Actions CI have not been run as part of this phase. No live Cloudflare resource was accessed or changed.
