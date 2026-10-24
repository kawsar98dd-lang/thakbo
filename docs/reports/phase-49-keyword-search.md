# THAKBO Phase 49 — Keyword Search

## Goal
Make public accommodation search easier by allowing visitors to search listing titles, descriptions, city names, and area names with one keyword, while retaining the existing location, budget, type, audience, facilities, availability, and radius filters.

## Changes
- Added optional `q` query-string parameter, normalized and capped at 100 characters.
- Search query applies the keyword to public-facing title, description, city, and area fields.
- All user input is bound as SQL parameters; no raw keyword is interpolated into SQL.
- Search form includes a keyword field.
- Pagination links preserve the keyword filter.
- Added validation and SQL-builder tests for keyword parsing, length limits, parameter binding, and placeholder counts.
- Existing published-only constraint remains unchanged.

## Privacy / safety
- Search does not expose internal listing IDs, owner data, contact details, exact addresses, or coordinates.
- Only published listings are searched.
- No database migration or production database change is required.

## Validation status
- Source changes and tests have been added, but full TypeScript, lint, unit test, and production build checks have intentionally been deferred to the final CI phase per the user's instruction.
- No GitHub push, Cloudflare deployment, or live test was performed.

## Suggested manual check after CI
1. Search `/search?q=student` and confirm matching published listings appear.
2. Combine keyword with city, price, type, and facilities.
3. Navigate to the next page and confirm `q` remains in the URL.
4. Try a keyword containing quote/SQL-like text and confirm the page remains usable.
5. Confirm no drafts or pending listings appear.
