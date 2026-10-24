# THAKBO Phase 55 — Database Query & Index Audit

Date: 2026-10-24
Base: Phase 54 Performance & Reliability source archive
Scope: source-level review only; no production database was accessed.

## Summary

Reviewed `db/migrations/0002_locations.sql`, `0004_listings.sql`, `0006_neighborhood_locations.sql`, `0011_visitor_analytics.sql`, `app/server/db/listing-search.ts`, and repository query patterns. Existing indexes cover many equality/filter patterns. This phase intentionally adds **no index migration** because production query plans and representative data-volume benchmarks were not available; adding indexes without that evidence can increase write/storage costs without improving the actual workload.

## Findings

### Existing index coverage

- Listing slug: `UNIQUE` constraint on `listings.slug` supports detail lookups.
- Owner dashboard: `idx_listings_owner_status (owner_id, status)` supports owner/status filtering.
- Public listing filters: existing indexes cover city, area, status/city/property type/rent, availability, published/created/updated timestamps, and coarse geographic filtering.
- Listing image retrieval: `idx_listing_images_listing (listing_id, sort_order)` supports ordered images per listing.
- Listing facilities/audiences: composite primary keys begin with `listing_id`, matching correlated lookup patterns; a facility-first index exists for reverse facility lookup.
- Location hierarchy and aliases have indexes for parent/city and area alias lookups.
- Analytics has indexes for daily/page type and listing/day lookup, including a partial index for non-null listing IDs.

### Query patterns that deserve measurement

1. Public keyword search in `app/server/db/listing-search.ts` uses `%term%` `LIKE` across title, description, city and area. Conventional B-tree indexes generally cannot accelerate a leading-wildcard search. Do not add ordinary indexes expecting to solve this. Consider a dedicated full-text strategy only after verifying Cloudflare D1/SQLite support, Bengali text behavior, migration/backfill safety, and realistic query plans.
2. Public search sorting varies by selected sort and filters. One composite index will not necessarily improve all variants; test representative combinations before choosing any new index.
3. Geographic filtering wraps latitude/longitude with `ROUND(...)`. Ordinary indexes on raw coordinate columns may not fully optimize those expressions. Preserve the existing privacy-related coordinate rounding; do not rewrite this behavior without a security review.
4. Cover image selection uses a correlated subquery ordered by image sort order and ID. The existing `(listing_id, sort_order)` index helps; the additional ID tie-break may still require checking with `EXPLAIN QUERY PLAN`.
5. OFFSET pagination cost can grow on deep pages. Do not change pagination semantics in this audit; consider keyset pagination as a separate compatibility-reviewed task.

## Safe next verification

Run query plans against a disposable/local D1 database with representative seeded data. Capture `EXPLAIN QUERY PLAN` for:

- public search with no filters and newest sort;
- city + area + property type + price range;
- keyword search;
- availability filter;
- owner/status listing query;
- listing cover image lookup;
- owner listing analytics aggregation.

Compare latency and rows scanned before and after any proposed index using the same dataset. Check insert/update/delete overhead too. Never run exploratory schema changes directly against production.

## Outcome

- No production D1 queries or schema operations performed.
- No migration added; this is deliberate pending evidence.
- No source behavior or UI changed in this phase.
- Full TypeScript, ESLint, Vitest and production build were not run in this environment. This report is not a claim that the application passes full CI.
