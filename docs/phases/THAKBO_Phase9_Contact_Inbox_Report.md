# THAKBO Phase 9 — Contact form and admin inbox

## Scope
Adds a functional public contact form and a protected admin inbox. This phase is additive and does not deploy, send email, or apply any production database migration.

## Changes
- Replaced the informational `/contact` page with a server-validated form for name, email, subject, and message.
- Added input length checks and email validation; all SQL writes use bound parameters.
- Added a hidden honeypot and a per-email 10-minute repeat-submission cooldown. These are basic safeguards, not a substitute for edge-level abuse/rate limiting.
- Added migration `0009_contact_messages.sql`, creating a constrained `contact_messages` table and indexes.
- Added admin-only `/admin/contact-messages` with status filters, pagination, internal notes, and `open` / `in_progress` / `closed` states.
- Added the Contact inbox tab to admin navigation.
- Updated production DB tooling's expected migration order and required table list.
- Added a database schema test for contact message constraints.

## Privacy and security
- The contact inbox is protected by the existing server-side admin middleware and `requireAdmin` check.
- Submitted content is rendered as React text, not injected HTML.
- Email and message content are not included in public responses or logs by this feature.
- No outbound email is sent. Admins must reply manually using their mail app.
- Messages contain personal data; restrict admin access and define a retention policy before broad launch.

## Required deployment action (not performed)
The new contact form will fail to store messages until migration `0009_contact_messages.sql` is applied to the D1 database used by the deployed Worker. Apply it only through the repository's guarded production database workflow after reviewing its preflight output. This ZIP does not run migrations or change production resources.

## Validation
- Full GitHub CI: not run for this phase yet; user plans to validate after a batch of updates.
- SQL migration and seed verification: pending in this phase's final local checks.
- Type-check, lint, Vitest and production build: pending GitHub CI.
