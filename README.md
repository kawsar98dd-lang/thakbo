# THAKBO (থাকবো) — *Find Where You Belong.*

THAKBO is a **location-first accommodation marketplace for Bangladesh** (mess, mess seats, rooms, flats, houses, sublets).
It starts in **Rajshahi** but is built for many cities. One account lets a person both **search** and **list places**.

> The project was first generated under the temporary name "NIVORA". The official working brand is now **THAKBO**.

## Documentation

সব Phase-এর বিস্তারিত রিপোর্ট এখন `docs/phases/` ফোল্ডারে রাখা হয়েছে। রিপোর্টের সূচি: [Phase Reports](docs/phases/README.md)। অন্যান্য documentation-এর সূচি: [docs/README.md](docs/README.md)।

---


**Current source status (19 October 2026 audit):** foundation, profiles, neighborhood-first location data, listing drafts/moderation, image handling, saved places, listing reports, admin report review and expanded search controls are present in the source. Recent edits fixed an admin-user query column mismatch, changed multi-select search controls to phone-friendly checkboxes, added English/Bangla area-alias resolution to search, made the save action sign-in-aware, widened the rounded-coordinate prefilter to avoid false negatives near radius boundaries, and added a privacy-rounded approximate distance label to location-based search cards. The admin location catalogue also now supports server-side search and pagination, so location rows beyond the previous fixed 500-row limit are reachable. The latest source audit reran the offline Python/SQLite checks successfully (70 Python unit tests plus SQL/static checks). The Node.js install, type-check, lint, Vitest suite, production build, GitHub Actions run and live Cloudflare behavior remain **unverified**; see `docs/phases/THAKBO_Phase37_Source_Audit_and_Cloudflare_Handoff.md`.

## SEO canonical origin and sitemap policy

`app/lib/constants.ts` defines `SITE.canonicalOrigin` as the one production origin used for canonical links, `og:url`, `robots.txt`, and `sitemap.xml`. It currently points to `https://thakbo.eu.cc`, the intended public launch domain. If the public domain changes later, update this value in one place before deployment. City and area URLs are included in the sitemap only when they have at least one published listing; individual listing URLs are included only while their status is `published`. Account, dashboard, and admin routes are not blocked in `robots.txt`, so crawlers can follow redirects and see `noindex` metadata where the response permits it; `/api/` is disallowed. `robots.txt` is not an access-control mechanism.

The latest on-page SEO phase adds Bengali explanatory copy to About/How it works, improves Bengali/English metadata on public contact/location/listing pages, and records the work in `docs/reports/phase-45-bengali-on-page-seo.md`. These changes do not replace CI, Preview, Search Console, or live-domain verification.

## বাংলায় সংক্ষেপে
* আপনার কম্পিউটারে কিছু চালাতে হবে না। প্রজেক্ট GitHub-এ আপলোড করলে **GitHub Actions** নিজে ক্লাউডে সব যাচাই করবে।
* GitHub-এ রিপোজিটরি খুলুন → **Actions** ট্যাব → **THAKBO CI** → সবুজ ✔ মানে পাস, লাল ✖ মানে ব্যর্থ। লাল হলে ব্যর্থ ধাপের লগ কপি করে আমাকে পাঠান; আমি ঠিক করে দেব।
* এই ZIP থেকে Cloudflare-এর D1/R2 resource সত্যিই account-এ আছে কি না যাচাই করা যায়নি। নিরাপদে যাচাইয়ের নির্দেশনা নিচের "Cloudflare setup" অংশে আছে।

---

## ⚠️ Verification status (honest summary)

| Check | Status |
|---|---|
| Code, configuration, migrations, README, CI workflow written | ✅ Done |
| SQL migrations + seed run on a real SQLite engine (also repeated automatically in CI by `scripts/verify-sql.py`) | ✅ Verified (in the authoring environment) |
| Syntax check of all `.ts/.tsx` files | ✅ No syntax errors (**not** a full type-check) |
| `npm ci` (dependency resolution) | ⏳ **Not verified for this update.** The authoring environment has no registry access/cache for at least one locked package; dependency installation did not complete. The Node version here is also below the project minimum. |
| Type-check, lint, unit tests, production build | ⏳ **Not yet executed** — run in GitHub Actions |
| Worker runtime, server rendering, Better Auth sign-up/login against a real D1 database | ❌ **Never tested** — needs Cloudflare resources (see "Remaining risks") |
| `package-lock.json` | ✅ Present in the supplied branch ZIP. If dependency declarations change, regenerate it in a registry-connected environment or use the lockfile workflow; never hand-edit or fake it. |

The authoring environment could not complete dependency installation because the npm registry was unreachable and the local cache did not contain every locked package. A green CI run is the proof; until it exists, treat this update as **not fully verified**. Package/type errors may still be reported by GitHub Actions.

---

## GitHub Actions — the verification path (no computer needed)

The owner does **not** need to run npm commands on a personal computer. GitHub Actions performs the verification in the cloud.

1. **Upload the project to GitHub** (works from a phone browser): create a repository on github.com, then *Add file → Upload files* and upload the **contents** of the ZIP (unzip first; keep the `.github` folder). Hidden folders such as `.github` may be easier to upload with the free **GitHub Codespaces**/GitHub's web editor or a Git app; see Troubleshooting.
2. Open the repository and tap the **Actions** tab.
3. Open the workflow **THAKBO CI** (it starts by itself after every upload; or tap *Run workflow*).
4. Wait a few minutes.
5. **Green ✔ = verification passed. Red ✖ = something failed** — open the run, tap the failed step (for example "Type-check"), copy the log text and send it to the developer assistant.

What THAKBO CI runs, in order: SQL migrations/seed check → install npm 11 → install dependencies (prints npm's debug log if it fails) → type-check (`wrangler types`, `react-router typegen`, `tsc`) → ESLint → Vitest tests (including a Better Auth schema contract test) → production build → Cloudflare Worker dry-run (informational only).

**Lockfile:** `package-lock.json` is committed. CI uses `npm ci` for reproducible dependency installation. If the lockfile must be regenerated, use *Actions → THAKBO Generate lockfile → Run workflow* and then re-run CI.

## Dependency notes (why the first install failed and what was changed)

**Failure:** `npm error Cannot read properties of null (reading 'edgesOut')` during `npm install`.

**Root cause:** a bug in npm 10.9's dependency resolver (the version bundled with Node 22), triggered by peer-dependency sets in the Vite 8 / Vitest tree. Documented evidence: another project reproduced the identical crash and verified the fix with `npx npm@10.9.2 install --package-lock-only` — Vite 8 has an optional peer on `@vitejs/devtools`, whose `@vitejs/devtools-vitest` declares the wildcard peer `vitest: "*"`; that wildcard can land on Vitest 5 even though the project asks for 4.x, and npm 10.9 crashes while building the peer set; npm 11 handles it. (Source: AgentWorkforce/relaycast pull request #370.) *I could not reproduce the crash myself because the authoring environment has no npm registry access; the fix follows that evidence and is confirmed only when a GitHub run goes green.*

**Fixes (no `--legacy-peer-deps`, nothing suppressed):**
1. `overrides` in `package.json` rewrites only the wildcard `vitest` peer of `@vitejs/devtools-vitest` to our own `^4.1.0` range. It works on every npm version, including Cloudflare's build environment.
2. CI and the lockfile generator use the exact **npm 11.19.1** (npm 11 resolves this tree).
3. A real `package-lock.json` (generated by GitHub) makes later installs use `npm ci`, which does not run the resolver at all.

**Compatibility review of the key packages** (from package metadata/release notes; each item is also guarded by `tests/dependency-policy.test.ts` where it can be):

| Package | Range | Why |
|---|---|---|
| `react-router`, `@react-router/dev` | exactly `8.4.0` (both) | `@react-router/dev` 8.x hard-pins its `react-router` peer to the identical version |
| `vite` | `^8.0.0` | React Router 8 needs Vite 7+; the Cloudflare plugin is tested on Vite 6, 7 and 8 |
| `@cloudflare/vite-plugin` + `wrangler` | `^1.62.3` + `^4.145.0` | plugin 1.62.x declares peer `wrangler ^4.145.0` (the pair must move together) |
| `tailwindcss`, `@tailwindcss/vite` | `^4.2.2` | Vite 8 support in `@tailwindcss/vite` starts at 4.2.2 |
| `vitest` | `^4.1.0` | Vitest 5 was released 2026-09-03 and is not part of the verified combination |
| `typescript` | `^5.9.0` | accepted by React Router's peer range (`^5.1 || ^6 || ^7`) |
| `better-auth` + `kysely` + `kysely-d1` | `^1.3.0`, `^0.28.0`, `^0.4.0` | **not yet verified** — see "Better Auth decisions"; the schema contract test checks the installed version |

If a future update breaks installation, change one family at a time and read the failed step's log (it now includes npm's debug log).

**Cloudflare Workers Builds** (the dashboard's GitHub deploy) also runs `npm install`/`npm ci`: the `overrides` entry protects it, and the committed lockfile makes it deterministic — generate the lockfile before connecting the repository.

## Milestone 2 — neighborhood-first locations, profiles, facilities, listing drafts

### How locations work
THAKBO is **neighborhood-first**: people search and list with the place names they actually use (Hetem Khan, Ghoshpara, Shaheb Bazar, Talaimari), not wards or thanas.

```
Country → Division → District → City → Neighborhood (area) → optional Sub-area
```
* The administrative levels (`countries`, `divisions`, `districts`, `cities`) stay in the database as structure and metadata. `areas.thana` and `areas.ward` are optional internal metadata; users never have to choose them.
* A **neighborhood** is a row in `areas` with a Bangla name (`name_bn`), English name (`name_en`), type (`neighborhood`, `para`, `residential_area`, `market_area`, `commercial_area`, `campus_area`, `landmark_area`, `road_area`, `other`), `search_priority`, coordinates (`latitude`/`longitude`, nullable), optional `radius_m`, and an active flag. A **sub-area** is just an area whose `parent_area_id` points to a neighborhood of the same city.
* A place is "active" only if it **and every ancestor** is active. Inactive places never appear in selectors, search or sitemap.
* Listings store `city_id`, `area_id` (the canonical neighborhood), optional `sub_area_id`, plus free text `address` and `landmark`. They never store the place name as loose text.
* The server rejects a neighborhood that does not belong to the selected city (and a sub-area that does not belong to the neighborhood). This is checked in `app/server/listing-service.server.ts` and covered by tests; it is **not** a database constraint (see Limitations).

### How aliases work
Every neighborhood has several known spellings in the table `area_aliases` (for Hetem Khan: "Hetem Khan", "Hatem Khan", "হেতেম খান", "হেটেম খান", "হাতেম খান"). Each alias is stored with a `normalized_alias`, produced by `normalizeLocationText()` (`app/lib/location.ts`):
* lower-cases; ignores spaces, punctuation and hyphens ("সাহেব বাজার" = "সাহেববাজার"); removes Latin accents and invisible joiner characters; collapses doubled Latin letters.
* It does **not** guess vowels and does **not** transliterate between Bangla and English. "Hatem" and "Hetem" are different keys; the alias table connects them. This deliberately prevents unrelated places from merging.
* `UNIQUE (city_id, normalized_alias)` makes an ambiguous alias impossible inside a city. Adding an alias that already belongs to another area is refused (`addAreaAlias` returns `alias_conflict`).
* Search (`GET /api/areas?cityId=1&q=hatem`) ranks exact alias → alias starting with the text → alias containing it, returns one row per area, at most a handful of results, and tells the user which alias matched. No browser ever receives a full location list.

### Growing from Rajshahi to all Bangladesh
Nothing in the code mentions Rajshahi. A new city or neighborhood is only **new rows** (`createCity`, `createArea`, `addAreaAlias`, `setAreaActive`, `updateArea` in `app/server/db/repositories/locations.ts` — the functions the Milestone 7 admin screens will call). Aliases are scoped per city, indexes are per city, and autocomplete is server-side and capped, so thousands of neighborhoods across many cities stay fast. Public URLs such as `/city/rajshahi` and `/area/rajshahi/hetem-khan` already work from the same slugs.

### Seed data
* `db/seeds/0001_reference_data.sql` (unchanged) — Bangladesh, Rajshahi, 8 areas, 14 facilities.
* `db/seeds/0002_neighborhoods_and_facilities.sql` — adds Hetem Khan and Ghoshpara, Bangla names, types, aliases for all 10 areas, Bangla/English facility labels, and 8 more facilities (Shared bathroom, Furnished, Semi-furnished, Balcony, Dining, Fan, AC, Washing machine).
* **Both are idempotent** (safe to run repeatedly), contain no users and no listings, and use **NULL coordinates** instead of invented ones. This is only a bootstrap list: Rajshahi has many more neighborhoods, and the Bangla spellings should be reviewed by a local before launch.
* The `normalized_alias` values in the seed are generated by `normalizeLocationText()`; `tests/location-repository.test.ts` re-computes every one and fails if they ever differ.

### Database changes (new migrations only; nothing existing was edited, renamed or deleted)
* `0006_neighborhood_locations.sql` — `is_active` on countries/divisions/districts; `name_en`/`name_bn` on cities; neighborhood columns on `areas` (names, `area_type`, `parent_area_id`, `radius_m`, `thana`, `ward`, `description`, `search_priority`); new table `area_aliases`; `listings.sub_area_id` and `listings.landmark`; `profiles.preferred_city_id`.
* `0007_facility_labels_and_audiences.sql` — `name_en`, `name_bn`, `category` on facilities; `listing_audiences` rebuilt (existing rows copied) to allow `mixed` and `anyone`.

**Apply them** with the same steps as before: `npm run db:migrate:remote` and `npm run db:seed:remote`, or — from the phone — paste `db/migrations/0006_…sql`, then `0007_…sql`, then the new seed file `db/seeds/0002_…sql` into the D1 console (run each file once, in this order). Migrations must not be run twice.

### Profiles, listings, facilities
* `/dashboard/profile` is functional: name, phone, WhatsApp, preferred city, bio. The profile that is read or updated is always the session user's; the browser never sends a user id, and avatar/roles cannot be changed from the form. One account system: seeker, owner and admin are not separate accounts (admin rights come only from the `admin_users` table).
* `/dashboard/listings/new` creates a **private draft** with sections: basic information, type, audience, price, location (city → neighborhood search → optional sub-area, address, landmark), facilities, availability. Drafts may be incomplete. `/dashboard/listings` shows only your own non-deleted listings; `/dashboard/listings/:id/edit` edits only your own **drafts**; delete is a soft delete.
* Facilities and audiences come from the database / shared constants, never from React components. A facility can be attached to a listing only once (primary key) and must exist and be active.
* Drafts are never public: public pages and search only ever return `status = 'published'`.
* Allowed owner status changes are listed in `OWNER_STATUS_TRANSITIONS` (`app/lib/constants.ts`). "Rented" is an availability status; "removed" is the existing `deleted` status. Submitting for review and moderation are described in the Milestone A section below.

### Tests (Milestone 2)
`tests/helpers/sqlite-d1.ts` runs the **real migrations and seed** on an in-memory SQLite database (Node's built-in `node:sqlite`), so repository and service tests exercise the true schema, constraints and SQL. New test files: `location-normalization`, `location-repository`, `location-validation`, `facilities-repository`, `profile-repository`, `profile-validation`, `listing-validation`, `listing-repository`, `listing-service`, `database-schema`, `auth-guards`.

### Milestone 2 verification status
| Check | Status |
|---|---|
| SQL migrations + both seeds (twice) on real SQLite (`scripts/verify-sql.py`) | ✅ passed in the authoring environment |
| Repository / service / schema tests from the earlier Milestone 2 work | Historical result: passed with a small stand-in runner (not Vitest itself); this does not verify the current changes |
| Zod validation tests, auth-guard tests, `npm ci`, type-check, lint, Vitest, production build | ⏳ **Not run** in the authoring environment (no npm registry). They run in GitHub Actions. |

### Limitations / decisions
* **City ↔ area consistency is enforced in code, not by a database constraint.** SQLite cannot add a composite foreign key without rebuilding the `listings` table (risky with data). A future hardening migration can add it; until then every write goes through `listing-service.server.ts`.
* **Property type `other`** is not added: it requires rebuilding `listings` (CHECK constraint) and its dependent tables. Add it in a dedicated migration if the business needs it. Existing types: mess, mess_seat, room, house, flat, sublet.
* Listing statuses keep the existing set (`draft`, `pending`, `published`, `paused`, `rejected`, `deleted`); `rented` lives in `availability_status`.
* Only the English/Bangla labels of cities, neighborhoods, facilities, property types and audiences exist. A full Bangla UI switch is not part of this milestone.
* The neighborhood picker needs JavaScript (it loads results from `/api/areas`).
* Listing image upload, location-point entry, radius search, favorites, contact flow and moderation screens are implemented in the current source; see the October 2026 implementation update below for what remains.

## Milestone A — listing submission and admin moderation

**Source status: implemented; local SQLite migration/seed verification passes. NOT applied to production.** Migration `0008_listing_moderation.sql` exists in the repository but has **not** been run against the production D1 database from this work; nothing was deployed, and no secret was changed.

### What owners can do
* Save and edit **drafts** without any minimum (no photo, location or contact needed).
* Choose the exact place with **"Use my current location"** (browser geolocation) or by pasting a **Google Maps link** (read locally in the browser/Worker; the link is never fetched). Nobody types latitude/longitude and no coordinate is ever invented or copied from a city centre. The server checks that the point is a finite number inside Bangladesh and, when the city has a known centre, within 60 km of it.
* Add up to **12 photos** (JPEG/PNG/WebP, 5 MB each; the real type is read from the file's bytes) while the listing is a draft or was rejected.
* **Submit for review**. The server (not the browser) requires title, description, type, city, neighborhood, a valid location, a rent above zero, at least one photo, and at least one valid phone/WhatsApp number on the owner's profile. All problems are returned at once, field by field.
* A **rejected** listing shows the moderator's reason, can be corrected in place and resubmitted.
* **Editing a published or paused listing** takes it offline in the same database statement and sends it back to review. There is no owner path back to `published` (the old `paused → published` shortcut was removed).

### Status rules (enforced in the service layer AND in the database)
`draft → pending` (owner, needs a photo) · `pending → published | rejected` (moderator only) · `pending → draft` (owner withdraws) · `published → pending` (owner edits) · `published/paused/rejected → draft` (owner) · `published → paused` (owner) · `paused/rejected → pending` (owner resubmits) · any → `deleted` (owner, soft delete).
Moderation compare-and-set: the update only succeeds while the listing is still `pending` and the reviewer is not its owner, so of two simultaneous decisions exactly one wins. Migration 0008 adds triggers that refuse illegal transitions, a decision by anyone who is not a *different*, registered `admin_users` member (administrators cannot approve their own listing), a listing entering review without a photo, and a rejection without a 10–500 character reason.

### Photo storage contract
`app/server/image-service.server.ts` depends on the small `ImageBucket` interface (store bytes with a content type; delete a key), not on Cloudflare's full `R2Bucket` type. The real binding satisfies it (the compiler checks this where the upload route passes `env.MEDIA_BUCKET`), and the in-memory fake used by tests is declared as an `ImageBucket`, so both are checked against the same contract.

### Moderation history
`listing_moderation_events` receives one row for **every** status change, written by a database trigger, so no code path can change a status without leaving a record (actor, role, action, from/to status, reason, time). The admin review page shows it.

### Admin screens
`/admin/listings` (pending queue, oldest first; tabs for rejected/published/paused) and `/admin/listings/:id` (full details including the private address, map point and owner phone/WhatsApp, photos, history, approve and reject with a mandatory reason). Both re-check `admin_users` on the server in the loader and the action.

### Privacy
Public search cards and area APIs do not contain the internal listing id, exact address, latitude/longitude, owner identifiers or storage keys. The public listing detail intentionally displays only the owner-provided phone/WhatsApp numbers as the contact mechanism; it never exposes the exact street address, pin coordinates, owner id or storage keys. Radius search rounds coordinates to two decimals before filtering/sorting to reduce exact-pin inference. Photos are served by `/images/:id` from the **private** R2 bucket: images of published listings are public (cached 5 min); everything else is visible only to the owner (and moderators for pending/paused/rejected listings), is `private, no-store`, and unauthorised requests get 404. Responses carry `nosniff`, a sandboxing CSP and `Content-Disposition: inline`.

### Database change (additive only — nothing in 0000–0007 was touched)
`0008_listing_moderation.sql`: four new nullable columns on `listings` (`submitted_at`, `reviewed_at`, `reviewed_by`, `rejection_reason`), the `listing_moderation_events` table with indexes and foreign keys, and three triggers. The existing coordinate `CHECK` constraint was **not** changed. `scripts/production_db.py` now lists 0008 in `EXPECTED_MIGRATIONS` (all of its safety checks still apply); running the production workflow would apply 0008, so run it only when you decide to.

### Current implementation update (October 2026)
The current source includes the public listing photo gallery, estimated monthly cost and deposit, public area/landmark map link, facility/audience details, phone/WhatsApp contact buttons, authenticated favorite saving/removal, listing reports with duplicate-pending-report protection, and admin report review/status notes. Search supports minimum/maximum rent, phone-friendly multi-select checkboxes for property type/audience/facilities, availability date, browser geolocation, a configurable radius, nearest-first ordering when coordinates are supplied, approximate distance labels based on privacy-rounded coordinates, and a clear-filters link. The radius-search control also accepts a full Google Maps link and extracts Bangladesh coordinates locally in the browser, so users can search around a chosen point without manually typing latitude/longitude; short links that require a network lookup are not resolved. The dashboard and admin overview also show database-backed summaries. A regression test now covers the Better Auth `createdAt` column used by the admin user list.

The admin Users page remains read-only to avoid unsafe account suspension. The Locations page now supports server-side search by area/city name or slug, pagination, and an admin-only, validated hide/enable action for areas; it preserves area rows and public slugs, and re-enabling requires active city and parent hierarchy. The Facilities page supports an admin-only, validated enable/hide action that preserves existing facility rows and listing references; renaming/editing catalogue values remains disabled until an audit/recovery workflow exists. Settings remain runtime diagnostics only. The map link opens the selected area in Google Maps; a fully embedded interactive map with listing pins is still not implemented. Search distance is a Bangladesh-local equirectangular approximation, not a geodesic guarantee. Photo re-ordering is available for editable listings (draft/rejected); owner notifications remain future work.

### Verification boundary
This ZIP has been source-edited and syntax-parsed (150 TypeScript/TSX files, zero syntax diagnostics), and the SQL migration/seed verification script has been run successfully in local SQLite. A focused SQLite check also confirms the admin user-list query orders users by Better Auth’s actual `createdAt` column. Full `npm run check` could not be completed in the authoring environment: its installed Node.js is v22.16.0 while this project and React Router 8.4.0 require Node.js >=22.22.0, and dependency installation could not fetch every locked package. The production DB fake-Wrangler self-test also did not complete within the local time limit, so it remains unverified here. Do not treat this as a green CI result or as proof of Cloudflare deployment. After uploading the ZIP to GitHub, run the repository CI workflow; resolve any actual runner diagnostics before deploying. No production D1 migration, Cloudflare secret, or deployment was run from this ZIP.

## Production database initialization (manual GitHub workflow)

The workflow **THAKBO Initialize Production D1** (`.github/workflows/initialize-production-db.yml`) creates the tables and reference data in the **existing** Cloudflare D1 database `thakbo-db` — no computer needed. It is **manual only** (no push/schedule trigger), completely separate from THAKBO CI, and it never creates, drops, resets or recreates a database and never deploys the Worker.

### What it does, in order
1. **Safety checks** — only on `main`; for `apply` you must type `THAKBO-DB`; both GitHub secrets must exist.
2. **Self-test** of the tooling (offline, fake wrangler on real SQLite).
3. **Preflight** — checks the 12 migration files are in the required order (0000 … 0011) and that no migration/seed contains destructive SQL (the only `DROP` allowed is the audience-table rebuild in 0007, which copies every row first); finds the **one existing** database named `thakbo-db` (by name, through the Cloudflare API) and reads its migration state. If the name is missing or ambiguous it stops. It does not edit `wrangler.jsonc`: the database id is written to a temporary config that is deleted at the end and never committed.
4. **Migrate** — `wrangler d1 migrations apply thakbo-db --remote`. Wrangler records every applied file in the table `d1_migrations` (set explicitly in the temporary config), so applied files are skipped on re-runs. If something fails part-way the workflow stops: **no seeding, no verification**.
5. **Seed** — `db/seeds/0001_reference_data.sql`, then `db/seeds/0002_neighborhoods_and_facilities.sql` (unchanged files, idempotent), only after all migrations succeeded. Re-running re-applies the seed-managed names/labels of the seeded places and facilities; rows you add yourself are untouched.
6. **Verify** — the run fails unless everything below is true.

It refuses to continue (and changes nothing) when the database **already has tables but no migration record** (for example the SQL was pasted by hand), or when the recorded migrations are unknown/out of order.

### One-time setup: GitHub secrets (works in a phone browser)
1. **Cloudflare API token:** dash.cloudflare.com → profile icon → *My Profile* → *API Tokens* → *Create Token* → *Create Custom Token*. Permission: **Account → D1 → Edit**, scope: your account only. Create it and copy the token (shown once). If preflight later reports a permission error, edit the token and also add **Account → Account Settings → Read**.
2. **Account ID:** Cloudflare dashboard → *Workers & Pages* (overview page) → *Account ID* on the right (or the long id in the dashboard URL).
3. **GitHub:** repository → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*. Create **`CLOUDFLARE_API_TOKEN`** and **`CLOUDFLARE_ACCOUNT_ID`** with exactly these names. Never paste them anywhere else (not in code, issues or chat).

### How to run
1. Make sure `package-lock.json` is in the repository (it is, from the lockfile helper) and the files of this update are on `main`.
2. *Actions* → **THAKBO Initialize Production D1** → *Run workflow* → branch `main`, **mode = `check`** → *Run*. This is read-only: it shows the state and what would be applied.
3. If the check is green and says `Database state : fresh` (or `tracked`), run it again with **mode = `apply`** and type **`THAKBO-DB`** in the confirmation box.
4. Green check = done. Open `https://thakbo.eu.cc/api/health` to confirm the app reaches the database.

### Expected verification results (fresh database, after `apply`)
| Check | Expected |
|---|---|
| Migrations recorded | `12/12` in the order 0000 … 0011 (current source migration set) |
| Required tables | `22/22` (Better Auth: user, session, account, verification, rateLimit; THAKBO tables; `d1_migrations`) |
| countries / divisions / districts / cities | `1/1/1/1` (Bangladesh, Rajshahi division, Rajshahi district, Rajshahi city with Bangla name) |
| Rajshahi active areas | `10` (Hetem Khan, Ghoshpara, Shaheb Bazar, Talaimari, Kazla, Motihar, Binodpur, Upashahar, Laxmipur, Sopura) |
| Rajshahi aliases | `25`; the spellings Hatem Khan / হেতেম খান / হেটেম খান / হাতেম খান / Saheb Bazar / সাহেববাজার resolve to the right area |
| Facilities | `22`, each with a Bangla label |
| Foreign-key violations | `0` |
| Informational | users and listings are only counted, never changed |

Later growth is allowed: the checks require *at least* these values (never fewer), so the workflow can be re-run after you add cities, areas or facilities.

### D1 seed compatibility rule
Seed (and migration) SQL must **not** use `UNION` / `UNION ALL` / `EXCEPT` / `INTERSECT` chains, and a `VALUES` list may have **at most 5 rows**. Production Cloudflare D1 rejects long compound SELECTs ("too many terms in compound SELECT") that a normal local SQLite accepts, so a seed can pass locally and still fail in production — this is exactly what stopped the first production run (seed 0001 used an 8-term `UNION ALL`). Write several small `INSERT OR IGNORE INTO … VALUES (…), (…)` statements instead. This is enforced three ways: statically in `scripts/production_db.py` (the production workflow refuses such SQL before touching the database), in `tests/seed-compatibility.test.ts`, and in `scripts/production_db_test.py` / `scripts/verify-sql.py`, which also emulate D1's strict limit on local SQLite. (The exact D1 limit is not documented in the sources used here, so the rule is deliberately stricter than needed.)

### If a run fails
* **Red at Preflight with "NO migration tracking":** tables exist but wrangler has no record (the SQL was run by hand). Nothing was changed. Do not delete anything; send the log of the `check` run to the developer assistant, who will prepare a safe reconciliation.
* **Red at "Apply pending migrations" with "PARTIALLY applied":** the migrations before the failing one are recorded and safe; the failing one was rolled back by D1; seeding and verification did not run. Read the error in the log, fix the cause (the developer assistant can do this from the log), then run the workflow again with `apply` — it continues with the remaining migrations.
* **Red at Seed:** migrations are complete. Fix the cause and re-run `apply` (seeds are idempotent).
* **Red at Verify:** read the `PROBLEM:` lines; do not ignore them.

### Verification status of this workflow
* ✅ The tooling logic (`scripts/production_db.py`) passes 48 tests (`scripts/production_db_test.py`) using a **fake wrangler** over a real SQLite file and the project's real migrations/seeds: fresh init, re-run, existing user data, untracked schema, unknown migrations, partial failure + rerun, failing seed, verification failures, secret hygiene, manual-only trigger.
* ⏳ **Never run against real Cloudflare.** Not yet verified with the real wrangler: the exact `d1 list --json` field names, `migrations apply` behavior without a terminal, the temporary config's `migrations_table`, `PRAGMA foreign_key_check` and `execute --file` on remote D1. The first real run (start with `check`) will show this; a failure there stops safely before any change.

## Technology

| Purpose | Choice |
|---|---|
| UI + server rendering | React 19, TypeScript (strict), **React Router v8** (framework mode, SSR on) |
| Hosting/runtime | **Cloudflare Workers** (`@cloudflare/vite-plugin`) |
| Database | **Cloudflare D1** (SQLite), plain SQL migrations, no ORM |
| Image storage | **Cloudflare R2** (binding only, no keys) |
| Sign-in | **Better Auth** (passwords, sessions, cookies — nothing home-made) |
| Styling / validation / tests | Tailwind CSS v4 / Zod / Vitest |
| Package manager | **npm** only |
| Node.js / npm | Node 22.22+ (CI uses `.nvmrc`), npm 11.19.1 in CI (see "Dependency notes") |

Additions beyond the blueprint (kept minimal): `kysely` + `kysely-d1` (how Better Auth talks to D1), `isbot` (standard server-rendering helper).

```
Browser → React Router → Cloudflare Worker ─┬─ Better Auth (/api/auth/*)
                                            ├─ D1  (binding "DB")
                                            └─ R2  (binding "MEDIA_BUCKET")
```

## Folder structure
```
.github/workflows/   ci.yml (verification) and generate-lockfile.yml (one-tap helper)
app/routes.ts        all URLs;  app/routes/ pages + resource routes (auth API, robots.txt, sitemap.xml, api/health)
app/components/      ui, layout, forms, listing, search
app/lib/             pure shared code: constants, Zod validation, geo, cost, seo, routes
app/server/          SERVER-ONLY: auth, sessions, middleware, logger, env, db/ (SQL + repositories), storage/ (R2)
workers/app.ts       Worker entry point
db/migrations/       numbered SQL migrations;  db/seeds/ reference data (no fake users/listings)
tests/               unit tests;  scripts/verify-sql.py  SQL check used by CI
wrangler.jsonc       Cloudflare configuration (bindings, no secrets, no fake ids)
```

## Environment variables and secrets
| Name | Kind | Meaning |
|---|---|---|
| `BETTER_AUTH_SECRET` | secret | Signs login sessions; at least 32 random characters. **Required at runtime** (not needed for CI). |
| `BETTER_AUTH_URL` | optional | Public site address; leave empty to auto-detect. |
| `DB`, `MEDIA_BUCKET` | bindings in `wrangler.jsonc` | D1 and R2. No keys or passwords. |

No secret is ever stored in Git. `.env.example` documents the names only. THAKBO has no browser-visible variables in Milestone 1.

## Cloudflare setup (account-specific; this ZIP cannot verify which resources already exist)

**Resource names used by this project:** D1 database `thakbo-db`, R2 bucket `thakbo-media`, Worker `thakbo`. These names are only *configuration*: **no database or bucket exists until the owner creates them in their own Cloudflare account.** No database id, account id or key is stored in this repository.

### Option A — Cloudflare dashboard (works from a phone browser)
1. **D1:** dashboard → *Storage & Databases → D1 SQL database → Create* → name `thakbo-db`. Note its **Database ID**.
2. **R2:** *R2 object storage → Create bucket* → name `thakbo-media` (R2 may ask for a payment method to enable its free tier — check Cloudflare's current terms).
3. **Connect the Worker:** *Workers & Pages → Create → Import a repository* → choose your GitHub repo. Build command `npm run build`, deploy command `npx wrangler deploy`.
4. **Bind the database:** For predictable migrations and remote database operations, create/identify `thakbo-db` and add its real `database_id` to the `d1_databases` entry using GitHub's web editor. Do not rely on automatic provisioning: this ZIP cannot verify how your authenticated deploy path will behave. Set the actual ID for a predictable deployment and migration workflow. Do not guess an ID.
5. **Create the tables:** use the repository's documented GitHub Actions workflow `THAKBO Initialize Production D1` in `check` mode first. Do not paste only some migrations by hand; the current project has migrations `0000` through `0011` and a guarded workflow that checks the existing database before applying them.
6. **Secret:** Worker → *Settings → Variables and Secrets → Add* → `BETTER_AUTH_SECRET` = a long random text (type "Secret").
7. Open `https://<your-worker>/api/health` — expected `{"status":"ok","database":"ok"}`.


### Cloudflare Preview build status (important)
The current repository **does have** a `previews.d1_databases` binding with a configured ID and a separate `thakbo-media-preview` R2 bucket name. This is only a repository-level configuration check: it does not prove that the Preview database ID or bucket exists in your Cloudflare account, or that Preview secrets are configured. Verify the ID and bucket in Cloudflare before relying on Preview. Never point Preview at production data. The production D1 binding intentionally has no ID in this starter ZIP; for deterministic deployment and migration operations, create/identify `thakbo-db` and put its real ID in the production `d1_databases` entry. Do not guess an ID.

Run this read-only diagnostic in GitHub Actions or a Python environment:
```bash
python3 scripts/check-preview-config.py
```
It does not contact Cloudflare or change any resource. To finish setup, the owner should create a separate preview D1 database (for example `thakbo-db-preview`) and the preview R2 bucket (`thakbo-media-preview`) in the same Cloudflare account, then add the real Preview D1 ID/binding under `previews.d1_databases` in `wrangler.jsonc`. **Never point a Preview at the production D1 database.** Configure `BETTER_AUTH_SECRET` in Cloudflare Preview Base secrets separately; never commit it. After those account-specific steps, re-run the diagnostic with `--strict` and inspect the Cloudflare build logs. The diagnostic is a repository config check, not a live account check.

### Option B — Wrangler commands (needs a terminal, e.g. free GitHub Codespaces in a browser)
```bash
npx wrangler login
npx wrangler d1 create thakbo-db            # prints database_id → add it to wrangler.jsonc
npx wrangler r2 bucket create thakbo-media
npm run db:migrate:remote                   # applies db/migrations in order
npm run db:seed:remote                      # optional reference data
npx wrangler secret put BETTER_AUTH_SECRET
npm run deploy
```
Local development (Codespaces/any terminal): `cp .env.example .dev.vars`, fill `BETTER_AUTH_SECRET`, then `npm run db:migrate:local`, `npm run db:seed:local`, `npm run dev`.

### First admin
After registering a normal account, run in the D1 Console (replace the e-mail):
```sql
INSERT INTO admin_users (user_id, role) SELECT id, 'admin' FROM "user" WHERE email = 'you@example.com';
```

## Database notes
* Migrations: `0000` Better Auth tables (+`rateLimit`), `0001` profiles/admin, `0002` locations, `0003` facilities, `0004` listings/images/facilities/audiences, `0005` favorites/reports. Never edit an applied migration — add a new numbered file.
* Location chain country → division → district → city → area: **new cities are only new rows**, no code change.
* Listings allow incomplete rows only while `status = 'draft'`; `status = 'deleted'` is a soft delete; money is whole taka; estimated monthly cost is calculated in code, never stored.
* Seed data: Bangladesh → Rajshahi (approximate city centre, area coordinates intentionally empty) + 22 facilities. **No fake users or listings.**
* All queries use bound parameters; the public search builder is unit-tested against injection.

## Better Auth decisions
* Better Auth handles password hashing, sessions and cookies. THAKBO contains no custom crypto.
* D1 is accessed through Kysely (`kysely-d1`); a new Better Auth instance is created per request because D1 bindings exist only during a request.
* Table columns are **camelCase** (`emailVerified`, `userId`, `expiresAt`, …) because that is what Better Auth's Kysely adapter uses by default. Dates are ISO text, booleans 0/1.
* **`tests/auth-schema.test.ts` compares migration `0000` with the columns the installed Better Auth version actually asks for**, so a mismatch is reported by CI instead of causing a runtime surprise.
* Sign-in/sign-up are rate-limited (5 per minute per rule), stored in D1 (`rateLimit` table). A profile row is created automatically for each new account.
* Password reset and e-mail verification are **not enabled** (they need an e-mail provider).

## Security summary
Server-side guards for `/dashboard/*` and `/admin/*` (admin role comes only from `admin_users`); owner checks in SQL (`getOwnedListing`); cross-site POST origin check; open-redirect-safe login redirects; security headers on every response; log redaction of passwords/tokens/cookies; no `dangerouslySetInnerHTML` (lint-enforced); image uploads validated by real file bytes, type and size, with server-generated object keys. Broader abuse/rate limiting beyond authentication remains a hardening task.

## Remaining risks / known limitations
* Not yet verified by a real install/build (CI will show).
* Better Auth + D1 behaviour (D1 has no interactive transactions) has not been tested at runtime.
* `app/server/*` repository files rely on React Router removing server-only imports from browser bundles; if the build reports a "server-only module" error, the developer assistant must rename those modules to `*.server.ts`.
* Migration 0008 (triggers) has been verified only against SQLite, not against real Cloudflare D1. Radius search uses coordinates rounded to two decimal places before filtering/sorting to reduce exact-pin inference; this is still approximate location privacy, not a guarantee against all inference.
* Password reset and e-mail verification are not enabled because they need an e-mail provider. The contact form stores messages in the admin inbox but does not send email automatically. An embedded interactive map with listing pins is not yet implemented.
* Fields from the MVP spec such as room/bathroom counts and an "account status" are not in the schema yet.

## Milestones
1 Foundation · 2 Profiles, neighborhood-first locations, facilities, listing drafts · 3 R2 upload + listing wizard · 4 Search filters and approximate radius search (embedded map remains) · 5 Listing details, favorites, contact, reports · 6 User dashboard · 7 Admin overview, listing moderation and report review (read-only catalogue/user pages) · 8 SEO, polish, performance, security, deployment.

## Troubleshooting
* **Uploading `.github` from a phone:** some mobile browsers hide dot-folders. Use github.com's *Add file → Create new file* and type the path `.github/workflows/ci.yml`, pasting the file content; repeat for `generate-lockfile.yml`. Or ask for help — this can also be done in a free browser Codespace.
* **CI red at "Install dependencies":** copy the lines under "Show npm debug log (only if install failed)" and the failing step; send both to the developer assistant.
* **CI red at "Type-check", "Lint", "Unit tests" or "Production build":** copy the failing step's log.
* `Invalid server configuration ... BETTER_AUTH_SECRET` → set the secret (Cloudflare step 6).
* `no such table` → run the migrations (Cloudflare step 5).


### Admin user directory (v8 update)
The admin user directory supports a read-only search by account name, display name, or email and paginates results to 25 accounts per page. Search values are parameterized and SQL LIKE wildcard characters are treated literally. Account suspension and role editing are intentionally not exposed; do not use this page as an account-recovery or access-control workflow.

### Recent update (v9)
The admin report queue now supports server-side pagination and displays the total number of reports, avoiding the previous silent 200-row ceiling. The report status filter is preserved during navigation. See `THAKBO_UPDATE_REPORT.txt` for validation results and remaining production-readiness checks.


## October 2026 update — Admin location catalogue pagination (v10)

The Admin Locations page now searches area/city names and slugs, paginates 25 records at a time, reports the matching record count, and clamps stale page numbers. Search input is length-limited and SQL LIKE wildcard characters are escaped; query values are bound parameters. This removes the previous UI/repository fixed 500-row ceiling for the admin location catalogue. Area enablement still validates the city and parent hierarchy on the server.

Historical verification for this v10 update: `python3 scripts/verify-sql.py` passed at that time (then 9 migrations and 21 tables, repeatable seeds and foreign-key check); `python3 scripts/production_db_test.py RepositoryRules -v` passed (6 tests); a focused Python SQLite smoke test passed for location search, literal `%`/`_` matching behavior, pagination and stale-page clamping. Full Vitest, semantic TypeScript type-check, ESLint, production build, GitHub Actions and Cloudflare live behavior remain unverified because dependency installation did not complete in the authoring environment. Do not treat this update as production-ready or as a green CI result.

## October 2026 update — Admin city catalogue (v13)

The admin area now includes `/admin/cities`, with server-side search by city name, Bangla/English city name, slug, district, and division; results are paginated in groups of 25. Admins can hide a city from public location selection without deleting its row, slug, areas, or listing references. Re-enabling is guarded server-side: the district, division, and country must all be active. Both the loader and mutation action require admin authorization; submitted IDs are validated and database values are bound parameters. This is visibility management, not a UI for creating cities or editing administrative geography.

Validation for v13: SQL migration/seed verification and Python configuration tests are run separately from the application tests. Full Vitest, semantic TypeScript type-check, lint, production build, GitHub Actions, and Cloudflare live behavior are not claimed as passed unless the corresponding runner result is available. Do not deploy solely on the basis of local SQL smoke checks.

### Preview D1 binding (v17)
The Preview-only D1 binding now uses the database ID supplied for `thakbo-preview`. Before deploying, confirm in the Cloudflare dashboard that this ID belongs to the intended Preview database, that `thakbo-media-preview` exists, and that required Preview secrets are configured. The local checker passing is not proof of a successful Cloudflare deployment.


### Contact inbox (Phase 9)
The public `/contact` page validates and stores messages in `contact_messages`. A hidden honeypot and a per-email 10-minute cooldown reduce simple bot and repeat submissions; these are lightweight safeguards, not comprehensive edge rate limiting. Admins can review messages at `/admin/contact-messages`, update status (`open`, `in_progress`, `closed`) and keep an internal note. The feature requires migration `0009_contact_messages.sql` to be applied to the target D1 database. The current migration set has since grown through `0010_moderation_audit_retention.sql`; use the complete guarded migration workflow rather than applying only one file. It does not send email automatically and does not alter existing tables.

## Resend password-reset email setup

Password reset uses Better Auth's built-in one-time reset token flow and Resend for email delivery. Configure these **Worker secrets/variables** in Cloudflare (do not put API keys in this repository):

- `RESEND_API_KEY` — a Resend API key with sending permission, stored as a Worker secret.
- `RESEND_FROM_EMAIL` — optional sender address, e.g. `THAKBO <noreply@trustedtoolsweb.com>`. The domain in this address must be verified in Resend.
- `BETTER_AUTH_URL` — optional; set this to the exact public THAKBO origin if Better Auth does not detect it correctly (currently `https://thakbo.eu.cc`).

The password-reset token expires after one hour, and other sessions are configured to be revoked after a successful password reset. The reset request page returns a generic success message to avoid disclosing whether an email address is registered. Test with an account whose mailbox you control before enabling this feature for production users. Do not share the Resend API key in chat, screenshots, or source control.
