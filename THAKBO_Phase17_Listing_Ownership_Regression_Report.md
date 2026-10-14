# THAKBO Phase 17 — Listing/Image Ownership Regression Coverage

## Scope
Added two regression tests in `tests/image-service.test.ts` without changing runtime application code or database schema.

1. Reordering: verifies that an image belonging to a different listing cannot be reordered by submitting that image ID alongside another listing ID; both listings' visible image orders remain unchanged.
2. Removal: verifies that an image cannot be removed by pairing its image ID with a different listing ID; the image database row and stored object remain present.

## Verification status
- Source-level review of the new tests: completed.
- ZIP integrity: checked after packaging.
- Vitest, TypeScript, lint, and production build: **not run** because dependencies (`node_modules`) are not installed in this workspace.
- GitHub CI and deployed behavior: **not verified**.

These tests document expected behavior; they have not been executed here and must be confirmed by CI.
