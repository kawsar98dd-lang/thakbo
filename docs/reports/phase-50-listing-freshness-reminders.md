# Phase 50 — Listing freshness reminders

## Scope
Adds owner-facing reminders in My Listings for published listings that have not been updated recently. Listings unchanged for 14+ days receive a gentle check reminder; listings unchanged for 30+ days receive a stronger review reminder.

## Safety and behavior
- Reminder is informational only. It does not pause, unpublish, delete, or otherwise change a listing.
- Only the authenticated owner sees these reminders on the existing private My Listings page.
- No database migration, scheduled job, external service, or new secret is required.
- Existing moderation, listing status, analytics, and edit flows are unchanged.
- Age is calculated from the existing `updatedAt` field; invalid timestamps are ignored.

## Validation status
Source change and basic structural review only. Full TypeScript, lint, tests, and production build must be run in the project's supported Node version as part of final CI. No live deployment or production data changes were performed.
