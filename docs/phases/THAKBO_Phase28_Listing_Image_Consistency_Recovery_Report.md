# THAKBO Phase 28 — Listing/Image Consistency & Storage Recovery Audit

## Scope
This phase adds a regression test for the interaction between listing soft-deletion, image metadata, private R2 objects, and the image-access policy. It does not change production data, R2 settings, or deletion behavior.

## Confirmed source behavior
- Upload writes the object to storage before inserting the `listing_images` row. If row registration fails or is refused, the service attempts to delete the uploaded object.
- Removing a photo deletes the database row first and then attempts to delete the R2 object. If the storage delete fails, the service logs a warning and returns success; an unreferenced object can remain in R2.
- Soft-deleting a listing changes its status to `deleted`. Existing image rows and objects are not automatically removed by the current listing status change path.
- The image access resolver denies images for deleted listings, including to the owner and admins/moderators. The image route returns 404 when access is denied.

## Change
`tests/image-service.test.ts` now includes a regression test that uploads a real test image through the service, soft-deletes its listing, and verifies:
1. the image metadata row remains;
2. the fake R2 object remains;
3. public, owner, and admin image access are all denied.

This captures the current behavior and guards against accidental exposure. It also makes the storage-retention trade-off explicit: soft-deleted listings can continue consuming R2 storage unless a separate cleanup/retention process is designed.

## Recommendation
Before adding automated cleanup, define a retention policy (immediate purge vs. delayed recovery window), make cleanup retryable, and add an operational report for unreferenced R2 objects. Do not run a destructive production cleanup without an approved retention rule and a dry-run inventory.

## Validation status
- Static source assertions and ZIP integrity check: performed after packaging.
- Vitest, TypeScript, ESLint, and production build: not run because `node_modules` is absent in the working tree.
- GitHub Actions and live Cloudflare D1/R2 behavior: not run/verified.
- No production database, bucket, or objects were changed.
