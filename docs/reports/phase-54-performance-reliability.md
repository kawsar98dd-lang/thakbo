# Phase 54 — Performance & Reliability

## Scope
This phase makes a small server-side performance improvement to owner analytics. It does not change the database schema, public routes, listing visibility rules, UI layout, or production configuration.

## Change made
- Added `getListingViewCounts()` in `app/server/analytics/analytics.server.ts` to fetch view totals for multiple listing IDs with grouped SQL queries.
- The function removes duplicate IDs, returns an empty map for an empty list, uses batches of at most 100 IDs to stay under conservative SQLite bind-variable limits, and preserves the existing graceful zero-count fallback if analytics queries fail.
- Updated the dashboard home and “My listings” loaders to use batched counts rather than issuing one analytics query per listing.
- Draft, pending, rejected, paused and deleted listings still do not expose view counts. Only published listings are passed to the batch query.
- Listing detail page continues to use the existing single-listing count function.

## Expected impact
For an owner with several published listings, this reduces analytics reads from one query per listing to one query per batch of up to 100 IDs. It does not reduce the number of listing records loaded, and no benchmark has been run; the improvement is based on reducing query count.

## Reliability and safety notes
- No migration or production database change is needed.
- No user-specific counts are exposed to other users; the existing route authentication and ownership-filtered listing repository remain in place.
- Analytics failures continue to degrade to zero counts rather than preventing the dashboard from rendering.
- This change does not alter image caching, media access permissions, login, moderation, listing submissions, or public page design.

## Validation status
- Source-level inspection of the changed analytics function and two dashboard loaders: completed.
- Dependency installation, TypeScript typecheck, ESLint, Vitest and production build: not run. The current environment has Node `v22.16.0`, while `.nvmrc` requires `v22.22.0`, and `node_modules` is absent.
- Runtime database tests and performance benchmarks: not run.
- No GitHub push, Cloudflare deployment, or production database operation performed.

## Required final release checks
Run the project's `npm run check` using the required Node/npm versions, review any failures, and validate in a non-production preview before deploying.
