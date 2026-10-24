# Phase 58 — GitHub CI Verification Handoff

## Purpose
This phase prepares a reliable, beginner-friendly handoff for the first real GitHub-hosted CI run. It does not claim that GitHub Actions has run; this workspace has no authenticated GitHub Actions session and the project dependencies are not installed locally.

## Scope and safety
- No application routes, components, styles, database migrations, production configuration, or secrets were changed.
- No GitHub push, Cloudflare action, production migration, or deployment was performed.
- The existing `.github/workflows/ci.yml` remains the source of truth for CI commands.

## Checks included in the existing workflow
1. Verify CI workflow references and run its checker tests.
2. Verify SQL migrations and seed data using temporary SQLite.
3. Report Cloudflare Preview configuration readiness.
4. Run static security configuration checks and their tests.
5. Run offline production-D1 tooling tests, Preview configuration tests, and R2 storage-tool tests.
6. Install the Node/npm versions and project dependencies in GitHub's runner.
7. Run TypeScript type-check, ESLint, Vitest, and production build.
8. Run a non-blocking Wrangler dry run. This final dry run is informational and does not mean the application was deployed.

## Known local verification boundary
The Phase 57 offline checks passed, including 70 Python tests and the SQL verifier. The local environment did not have `node_modules`, and its Node version was 22.16.0 while `.nvmrc` specifies 22.22.0. Therefore, TypeScript, lint, Vitest, build, and Wrangler dry-run results are not established until the GitHub workflow actually runs.

## Pass criteria
- The workflow run finishes with a green check.
- Required steps `Type-check`, `Lint`, `Unit tests`, and `Production build` all pass.
- Review the `Cloudflare Worker dry run (informational)` step separately; it is configured with `continue-on-error: true`, so it can fail without making the overall job fail.
- A green workflow is not proof that production bindings/secrets are configured correctly or that the live site passed a browser smoke test.

## If the workflow fails
Do not deploy. Open the failed run, expand the first red step, and capture the step name plus the complete error block (remove any tokens/secrets before sharing). Fix the earliest real failure first, then rerun CI. Do not share `.env` files, API tokens, session cookies, database credentials, or secret values.

## After CI passes
Run a Preview-only smoke test: home page, search/location filters, listing details, sign-in/sign-up, listing submission and moderation, owner dashboard, reports, admin analytics, and image upload. Verify that Preview is connected only to its separate Preview D1/R2 resources. Do not apply remote migrations or deploy to production until the production D1 database ID and resources are explicitly verified.
