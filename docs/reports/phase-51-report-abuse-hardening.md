# Phase 51 — Report Abuse Hardening

## Scope
- Normalize user-provided report details before database submission.
- Normalize internal admin notes before saving moderation records.
- Add focused unit tests for whitespace, control characters, and Bangla/Unicode text.
- Preserve existing signed-in-only reporting, one-pending-report-per-user/listing guard, 10 reports per 24-hour limit, and admin authorization.

## Security boundaries
- This phase does not automatically label or remove listings as fake.
- Report text remains untrusted user content and should be rendered as text, not HTML.
- No schema migration or production database operation is included.

## Verification status
- Source changes and test cases added.
- Full Vitest, TypeScript, ESLint, and production build must be run in the final CI pass; these are not claimed as passed here.
- No GitHub push or Cloudflare deployment was performed.
