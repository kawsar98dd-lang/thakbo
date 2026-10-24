# Phase 59 — Light/Dark Theme Contrast Hardening

## Purpose
Fix the visible contrast defect in the provided mobile screenshot: the public statistics panel uses a white-heavy gradient in dark mode, making the description text difficult to read.

## Changes
- Added a dedicated `home-analytics-panel` class to the homepage statistics panel.
- Explicitly set readable dark and light surfaces, heading/body text, metric tiles, labels, and numbers for that panel.
- Hardened dark-mode handling for common white/brand gradient stops and neutral gray utility classes.
- Kept the homepage hero's intentionally dark gradient unchanged.
- No routes, data, database migrations, authentication, Cloudflare bindings, secrets, or deployment behavior changed.

## Verification limits
- Source-level review and ZIP integrity can be checked locally.
- Full TypeScript/Lint/Vitest/production build require the project's pinned Node version and installed dependencies; do not claim these passed unless CI actually runs.
- Must visually verify both light and dark modes on mobile and desktop after deployment to Preview.
