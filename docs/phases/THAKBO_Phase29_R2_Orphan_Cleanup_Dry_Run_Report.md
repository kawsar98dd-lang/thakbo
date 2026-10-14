# THAKBO Phase 29 — R2 Orphan-Candidate Dry-Run & Operational Safety

## Goal
Prepare a conservative, non-destructive way to identify potential R2 objects that are not referenced by `listing_images`. No production data or R2 objects were accessed or changed in this phase.

## Source-backed behavior
- Upload writes an R2 object before registering its row in D1. If D1 registration fails, the app attempts to delete the object; a failed cleanup is logged and may leave an orphan.
- Photo removal deletes the D1 row first, then attempts the R2 delete. If the R2 delete fails, the object can remain unreferenced.
- Soft-deleting a listing does not currently remove its image rows or R2 objects. These are not orphan candidates while their rows still reference them.
- The current app has no durable cleanup queue/retry mechanism for failed R2 deletes. This phase does not add one because a retention policy and production operational requirements have not been approved.

## Changes
- Added `scripts/r2-cleanup-plan.py`, an offline report generator. It reads exported D1 object keys and R2 inventory JSON; it does not connect to Cloudflare and contains no delete operation.
- It reports only keys that are absent from the supplied D1 key set, match the strict generated THAKBO key pattern (`listings/<UUID>/<UUID>.(jpg|png|webp)`), and are older than the requested retention threshold.
- Invalid-key and too-recent objects are excluded and counted separately. The report contains a mandatory review checklist and explicit `DRY_RUN_ONLY_NO_DELETIONS` mode.
- Added `tests/scripts/test_r2_cleanup_plan.py` to test candidate filtering, malformed input, retention threshold, and UTC timestamp requirements.

## How to use (after obtaining reviewed exports)
D1 export JSON shape:
```json
{"object_keys": ["listings/<listing-uuid>/<image-uuid>.jpg"]}
```
R2 inventory JSON shape:
```json
{"objects": [{"key": "listings/<listing-uuid>/<image-uuid>.jpg", "uploaded_at": "2026-01-01T00:00:00Z"}]}
```
Run locally:
```sh
python3 scripts/r2-cleanup-plan.py --d1-json d1-image-keys.json --r2-json r2-inventory.json --retention-days 30 --output r2-cleanup-candidates.json
```
For a repeatable report, supply `--now 2026-10-14T12:00:00Z`. The script requires inventory timestamps to be UTC ISO-8601 values ending in `Z`.

## Safety limits
- This is only as accurate as the exported inventories. The D1 and R2 snapshots should be captured close together; a stale D1 export can create false positives.
- A candidate is not authorization to delete. Re-check each key against live D1 immediately before any future deletion, review retention/legal requirements, and obtain explicit operational approval.
- This script never deletes, queues, or modifies objects. No automatic cleanup workflow was added.
- R2 inventory export itself is not implemented by this script; obtain it through an approved Cloudflare inventory/export method and normalize it to the documented JSON format.

## Validation performed
- `python3 -m unittest discover -s tests/scripts -v`: 3 tests passed.
- `python3 -m py_compile scripts/r2-cleanup-plan.py tests/scripts/test_r2_cleanup_plan.py`: passed.
- `python3 scripts/r2-cleanup-plan.py --help`: passed.
- Full Vitest, TypeScript, ESLint, production build, GitHub Actions, and live Cloudflare D1/R2 checks were not run.
