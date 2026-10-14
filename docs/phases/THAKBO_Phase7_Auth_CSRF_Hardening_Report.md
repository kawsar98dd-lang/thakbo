# THAKBO Phase 7 — Authentication / CSRF hardening

## Scope
This phase makes a narrowly scoped defense-in-depth improvement to the global state-changing-request Origin check. It does not enable password reset, change auth provider configuration, migrate the database, or deploy anything.

## Change
- Existing behavior remains: unsafe methods with a mismatched `Origin` are rejected.
- Added Fetch Metadata fallback: if an unsafe request has no `Origin` but explicitly says `Sec-Fetch-Site: cross-site`, reject it.
- Safe methods remain unaffected.
- Origin-less non-browser clients remain compatible; this check is not a replacement for route-level authentication/authorization or SameSite cookies.

## Regression tests added
- same-origin POST accepted
- cross-origin POST rejected
- origin-less `Sec-Fetch-Site: cross-site` POST rejected
- origin-less request without Fetch Metadata accepted
- GET with foreign Origin remains allowed

## Verification status
- ZIP integrity: verified after packaging.
- Source-level review: performed.
- Vitest / TypeScript / ESLint / production build: not verified in this environment because `npm ci` did not complete; the registry operation timed out and only a partial `node_modules` directory appeared.
- Cloudflare runtime behavior: not verified.

## Safety
No GitHub push/merge, Cloudflare deployment, or production database changes were made.
