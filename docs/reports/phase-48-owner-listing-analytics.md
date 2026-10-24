# Phase 48 — Owner listing analytics

## Scope
- Adds an owner-only summary of tracked views for the owner's published listings on the dashboard.
- Adds per-listing tracked view counts to the owner's “My listings” page, only for published listings.
- Uses the existing Phase 47 analytics table/helper; no new migration or schema change.
- Draft, pending, rejected, paused, and deleted listings do not display view counts.
- Does not expose other owners' listing analytics or add visitor identities.

## Validation and deployment status
- Source change reviewed for ownership boundary: both pages require the signed-in user and use `listOwnedListings` for that user.
- Not deployed to Cloudflare and no production database writes were performed.
- Full TypeScript/lint/test/build validation remains pending because the previous environment could not complete `npm ci`; run the repository's normal CI before merging/deploying.
- Requires Phase 47 migration `0011_visitor_analytics.sql` to already be applied in the active D1 database. If analytics tables are missing, the view-count helper fails closed to zero.
