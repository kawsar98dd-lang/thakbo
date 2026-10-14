# THAKBO Phase 10 — Search-area map experience

## Changes
- Added `app/components/search/SearchAreaMap.tsx` and connected it to `/search`.
- When a user has selected a valid search point within Bangladesh, the results page can show/hide an OpenStreetMap embed centred on that user's search point and radius.
- The map is lazy-loaded and only requested when the user explicitly opens it.
- The component receives only the search centre supplied in search parameters. It does not query, expose, or plot rental-property coordinates.
- Map bounds are limited to Bangladesh and the selected radius is clamped before constructing the embed URL.
- No new npm dependency, API key, database migration, or Cloudflare binding is required.

## Privacy/design limitation
This is the first map milestone: it visualizes the selected search area, not property pins. Public listing queries intentionally exclude property coordinates to prevent revealing exact addresses. A future pin-based map requires a separate privacy-reviewed approximate-coordinate design and should not expose exact owner coordinates.

## Verification
- Source changes reviewed for URL construction, bounds validation, lazy loading, and privacy boundary.
- Full TypeScript, lint, unit tests, and production build were not run in this environment because project dependencies are not installed and network installation is unavailable.
- GitHub CI has not been run for this ZIP. Do not consider this phase CI-verified until the combined update is uploaded and CI passes.
