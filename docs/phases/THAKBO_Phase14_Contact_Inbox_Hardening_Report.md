# THAKBO Phase 14 — Contact inbox hardening

## Scope
A focused follow-up to the Phase 9 contact inbox, based on source review. No database schema, environment secret, production resource, or deployment changes were made.

## Change
- Reworked the 10-minute duplicate-submission lookup to compare the stored ISO-8601 UTC timestamp directly against an ISO-8601 UTC cutoff, instead of wrapping `created_at` in `julianday()`.
- The existing `(email, created_at DESC)` index can now be considered by SQLite for the timestamp range, avoiding a function on the indexed column. Actual query-plan/performance measurement has not been run against the deployed D1 database.

## Security review notes
- Public form input is validated server-side and inserted using bound SQL parameters.
- State-changing requests are covered by the root origin-check middleware; admin inbox loader/action also call `requireAdmin`.
- Submitted message text is rendered as React text, not injected HTML.
- The email cooldown is only a basic duplicate/abuse guard and is not robust distributed rate limiting. Add Cloudflare edge rate limiting or another abuse-control layer before broad public launch.
- Message retention policy and authorized admin access should be reviewed before launch. No automatic email is sent by this feature.
- Contact inbox still depends on migration `0009_contact_messages.sql` being applied to the intended D1 database.

## Validation status
- Source change assertion: passed.
- ZIP archive integrity: checked after packaging.
- Typecheck, lint, Vitest, production build, GitHub CI, deployed D1 query plan, and live deployment: not run in this phase.
