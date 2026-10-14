# THAKBO Phase 27 — Image Storage Key Validation & Access Audit

## Scope
This phase tightens the final storage-key validation used by the image-serving route and adds regression coverage. It does not change R2 bucket configuration or delete/modify stored production objects.

## Finding
The image-serving route derives a response `Content-Type` from the database-backed `object_key`. Previously, `mimeFromKey` accepted any string ending in `.jpg`, `.png`, or `.webp`. This was permissive: a malformed or unexpected database value could be treated as a valid image key based only on its extension.

## Change
- `app/server/storage/media.server.ts`: `mimeFromKey` now accepts only the expected `listings/<canonical UUID>/<canonical UUID>.(jpg|png|webp)` layout and returns `null` for anything else.
- `tests/image-service.test.ts`: added positive cases for each supported image type and negative cases for arbitrary paths, traversal-like segments, malformed IDs, extra path segments, unsupported extensions, and uppercase UUID paths.

The image route already returns 404 when `mimeFromKey` returns `null`, so malformed keys fail closed before an R2 read.

## Validation status
- Source-level consistency checks and ZIP integrity check: performed after packaging.
- Vitest, TypeScript, ESLint, and production build: not run because `node_modules` is absent in the working tree.
- GitHub Actions CI and live Cloudflare/R2 behavior: not run/verified.
- No production database, bucket, or objects were changed.

## Notes
This is a narrow storage-key validation hardening, not a full penetration test or image-content decoder. `sniffImageType` checks signatures, not full image decoding/re-encoding. A later media-processing phase could evaluate pixel dimensions and decode/re-encode policy if supported by the runtime and project requirements.
