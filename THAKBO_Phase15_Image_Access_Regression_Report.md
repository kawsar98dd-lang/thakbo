# THAKBO Phase 15 — Image Access Regression Coverage

## Scope
This phase adds focused regression tests around private listing-image access, using the existing image service and SQLite/D1 test harness. No production runtime code, database migration, environment variable, or storage configuration was changed.

## Added checks
- A moderator who is initially allowed to view a pending listing image loses that access after their `admin_users` role row is removed.
- The listing owner retains private access to their own pending image after moderator access is revoked.
- Anonymous viewers remain denied access to pending images.
- A regular user who is not registered in the moderator table cannot view rejected listing images.

## Verification status
- Source edits inspected: yes.
- ZIP archive integrity: checked after packaging.
- Vitest, TypeScript, lint, and production build: not run in this environment; do not treat this phase as CI-verified.
- Live deployment or live access-control behavior: not tested.

## Next recommended checks
Run the repository's GitHub Actions CI against the combined ZIP before deployment. Confirm private image access behavior with authenticated owner, moderator, regular-user, and anonymous sessions in a non-production environment.
