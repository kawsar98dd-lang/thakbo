# THAKBO Phase 44 — Homepage Recent Listings Feed

Date: 2026-10-20

## What changed
- Added a Recent places to rent section between Popular areas and the existing List a Place call-to-action.
- Displays up to 12 published listings, ordered newest-first using the existing public listing search repository and its deterministic published-at/id sort.
- Reuses the existing responsive `ListingCard` component to keep the homepage visual language consistent and avoid duplicating property presentation logic.
- Includes responsive one/two/three-column layout, a clear empty state, and links to the existing search page for browsing all/newest results.
- Uses the existing public listing query, which filters to `status = 'published'` and intentionally omits owner details, exact address, coordinates, internal IDs, and storage object keys.
- Keeps location loading and recent-listing loading failure-isolated so a feed failure does not prevent the hero/search/other homepage sections from rendering.
- No database migration, secrets, production configuration, licensing/authentication, or live deployment changes.

## Validation
- Reviewed the current home route, shared ListingCard, listing repository, and public search SQL builder.
- Confirmed newest-first sorting is the existing `published_at DESC, id DESC` query order and the query fetches one extra row to determine whether more results exist.
- Archive integrity and changed-file checks are performed during packaging.
- Full typecheck/lint/test/build were not run in this environment: the package requires Node >=22.22.0, while the available runtime is Node 22.16.0, and `node_modules` is not installed. Run the repository CI checks before merging/deploying.

## Scope note
The homepage's “Browse more listings” control leads to the existing full search results page rather than implementing a new in-place infinite-scroll API. This avoids adding a new endpoint or altering the established search/pagination behavior in this focused UI-safe phase.
