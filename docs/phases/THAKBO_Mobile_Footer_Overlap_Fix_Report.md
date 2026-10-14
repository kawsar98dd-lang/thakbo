# THAKBO Mobile Footer / Bottom Navigation Overlap Fix

## Problem
On mobile, the primary tab bar is fixed to the viewport bottom. The main content already had bottom padding, but the site footer comes after `<main>`, so the footer's own last lines/links could still sit behind the fixed tab bar near the end of the page.

## Change
Updated `app/components/layout/SiteFooter.tsx` to add mobile-only bottom padding:

`pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0`

This reserves space for the fixed mobile tab bar plus the device safe-area inset, while removing the extra reservation on desktop (`md:pb-0`). Footer content should now be scrollable fully above the mobile navigation rather than hidden behind it.

## Validation
- Source change inspected.
- ZIP archive integrity check performed after packaging.
- TypeScript, lint, Vitest, and production build were not run in this environment. Re-run GitHub Actions after uploading the updated files.
