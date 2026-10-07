# THAKBO (থাকবো) — *Find Where You Belong.*

THAKBO is a **location-first accommodation marketplace for Bangladesh** (mess, mess seats, rooms, flats, houses, sublets).
It starts in **Rajshahi** but is built for many cities. One account lets a person both **search** and **list places**.

> The project was first generated under the temporary name "NIVORA". The official working brand is now **THAKBO**.

**Status: Milestone 1 (foundation) is verified green in GitHub Actions. Milestone 2 (profiles, neighborhood-first locations, facilities, listing drafts) is implemented and awaiting its first GitHub Actions run — see "Milestone 2" below for exactly what was and was not verified.**

## বাংলায় সংক্ষেপে
* আপনার কম্পিউটারে কিছু চালাতে হবে না। প্রজেক্ট GitHub-এ আপলোড করলে **GitHub Actions** নিজে ক্লাউডে সব যাচাই করবে।
* GitHub-এ রিপোজিটরি খুলুন → **Actions** ট্যাব → **THAKBO CI** → সবুজ ✔ মানে পাস, লাল ✖ মানে ব্যর্থ। লাল হলে ব্যর্থ ধাপের লগ কপি করে আমাকে পাঠান; আমি ঠিক করে দেব।
* Cloudflare-এর D1/R2 এখনো তৈরি হয়নি। কীভাবে তৈরি করবেন তা নিচে "Cloudflare setup"-এ আছে।

---

## ⚠️ Verification status (honest summary)

| Check | Status |
|---|---|
| Code, configuration, migrations, README, CI workflow written | ✅ Done |
| SQL migrations + seed run on a real SQLite engine (also repeated automatically in CI by `scripts/verify-sql.py`) | ✅ Verified (in the authoring environment) |
| Syntax check of all `.ts/.tsx` files | ✅ No syntax errors (**not** a full type-check) |
| `npm install` (dependency resolution) | ⏳ **Not yet verified.** The first GitHub run **failed** here (`Cannot read properties of null (reading 'edgesOut')`); the cause was diagnosed and fixed (see "Dependency notes"), but the fix has **not** been confirmed by a new run yet |
| Type-check, lint, unit tests, production build | ⏳ **Not yet executed** — run in GitHub Actions |
| Worker runtime, server rendering, Better Auth sign-up/login against a real D1 database | ❌ **Never tested** — needs Cloudflare resources (see "Remaining risks") |
| `package-lock.json` | ⏳ Not generated yet — it can only be created where the npm registry is reachable (GitHub). Use the "THAKBO Generate lockfile" workflow. It is never faked. |

The authoring environment had no internet access, so nothing that needs `npm` could run there. A green CI run is the proof; until it exists, treat the project as **unverified**.
Package versions were chosen from current documentation; **the first CI run may reveal version or type problems — that is expected and is what CI is for.**

---

## GitHub Actions — the verification path (no computer needed)

The owner does **not** need to run npm commands on a personal computer. GitHub Actions performs the verification in the cloud.

1. **Upload the project to GitHub** (works from a phone browser): create a repository on github.com, then *Add file → Upload files* and upload the **contents** of the ZIP (unzip first; keep the `.github` folder). Hidden folders such as `.github` may be easier to upload with the free **GitHub Codespaces**/GitHub's web editor or a Git app; see Troubleshooting.
2. Open the repository and tap the **Actions** tab.
3. Open the workflow **THAKBO CI** (it starts by itself after every upload; or tap *Run workflow*).
4. Wait a few minutes.
5. **Green ✔ = verification passed. Red ✖ = something failed** — open the run, tap the failed step (for example "Type-check"), copy the log text and send it to the developer assistant.

What THAKBO CI runs, in order: SQL migrations/seed check → install npm 11 → install dependencies (prints npm's debug log if it fails) → type-check (`wrangler types`, `react-router typegen`, `tsc`) → ESLint → Vitest tests (including a Better Auth schema contract test) → production build → Cloudflare Worker dry-run (informational only).

**Lockfile (one tap):** until `package-lock.json` exists, CI uses `npm install` (and attaches the generated lockfile to the run as a downloadable "package-lock" artifact). The recommended way: open *Actions → THAKBO Generate lockfile → Run workflow*. It resolves all dependencies on GitHub's server, checks them with `npm ci --dry-run`, and saves the real `package-lock.json` into the repository. Afterwards run THAKBO CI again; it automatically switches to the stricter `npm ci`. (If GitHub reports a permissions error: *Settings → Actions → General → Workflow permissions → Read and write permissions*.)

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
* Allowed owner status changes are listed in `OWNER_STATUS_TRANSITIONS` (`app/lib/constants.ts`). "Rented" is an availability status; "removed" is the existing `deleted` status. Submitting a draft for review is Milestone 3; moderation is Milestone 7.

### Tests (Milestone 2)
`tests/helpers/sqlite-d1.ts` runs the **real migrations and seed** on an in-memory SQLite database (Node's built-in `node:sqlite`), so repository and service tests exercise the true schema, constraints and SQL. New test files: `location-normalization`, `location-repository`, `location-validation`, `facilities-repository`, `profile-repository`, `profile-validation`, `listing-validation`, `listing-repository`, `listing-service`, `database-schema`, `auth-guards`.

### Milestone 2 verification status
| Check | Status |
|---|---|
| SQL migrations + both seeds (twice) on real SQLite (`scripts/verify-sql.py`) | ✅ passed in the authoring environment |
| Repository / service / schema tests (location, facilities, profile, listing, schema) executed against real SQLite | ✅ passed in the authoring environment using a small stand-in test runner (not Vitest itself) |
| Zod validation tests, auth-guard tests, `npm ci`, type-check, lint, Vitest, production build | ⏳ **Not run** in the authoring environment (no npm registry). They run in GitHub Actions. |

### Limitations / decisions
* **City ↔ area consistency is enforced in code, not by a database constraint.** SQLite cannot add a composite foreign key without rebuilding the `listings` table (risky with data). A future hardening migration can add it; until then every write goes through `listing-service.server.ts`.
* **Property type `other`** is not added: it requires rebuilding `listings` (CHECK constraint) and its dependent tables. Add it in a dedicated migration if the business needs it. Existing types: mess, mess_seat, room, house, flat, sublet.
* Listing statuses keep the existing set (`draft`, `pending`, `published`, `paused`, `rejected`, `deleted`); `rented` lives in `availability_status`.
* Only the English/Bangla labels of cities, neighborhoods, facilities, property types and audiences exist. A full Bangla UI switch is not part of this milestone.
* The neighborhood picker needs JavaScript (it loads results from `/api/areas`).
* No image upload, map, radius search, favorites, contact flow or admin screens were added.

## Production database initialization (manual GitHub workflow)

The workflow **THAKBO Initialize Production D1** (`.github/workflows/initialize-production-db.yml`) creates the tables and reference data in the **existing** Cloudflare D1 database `thakbo-db` — no computer needed. It is **manual only** (no push/schedule trigger), completely separate from THAKBO CI, and it never creates, drops, resets or recreates a database and never deploys the Worker.

### What it does, in order
1. **Safety checks** — only on `main`; for `apply` you must type `THAKBO-DB`; both GitHub secrets must exist.
2. **Self-test** of the tooling (offline, fake wrangler on real SQLite).
3. **Preflight** — checks the 8 migration files are in the required order (0000 … 0007) and that no migration/seed contains destructive SQL (the only `DROP` allowed is the audience-table rebuild in 0007, which copies every row first); finds the **one existing** database named `thakbo-db` (by name, through the Cloudflare API) and reads its migration state. If the name is missing or ambiguous it stops. It does not edit `wrangler.jsonc`: the database id is written to a temporary config that is deleted at the end and never committed.
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
4. Green check = done. Open `https://thakbo.kawsar98dd.workers.dev/api/health` to confirm the app reaches the database.

### Expected verification results (fresh database, after `apply`)
| Check | Expected |
|---|---|
| Migrations recorded | `8/8` in the order 0000 … 0007 |
| Required tables | `21/21` (Better Auth: user, session, account, verification, rateLimit; THAKBO tables; `d1_migrations`) |
| countries / divisions / districts / cities | `1/1/1/1` (Bangladesh, Rajshahi division, Rajshahi district, Rajshahi city with Bangla name) |
| Rajshahi active areas | `10` (Hetem Khan, Ghoshpara, Shaheb Bazar, Talaimari, Kazla, Motihar, Binodpur, Upashahar, Laxmipur, Sopura) |
| Rajshahi aliases | `25`; the spellings Hatem Khan / হেতেম খান / হেটেম খান / হাতেম খান / Saheb Bazar / সাহেববাজার resolve to the right area |
| Facilities | `22`, each with a Bangla label |
| Foreign-key violations | `0` |
| Informational | users and listings are only counted, never changed |

Later growth is allowed: the checks require *at least* these values (never fewer), so the workflow can be re-run after you add cities, areas or facilities.

### If a run fails
* **Red at Preflight with "NO migration tracking":** tables exist but wrangler has no record (the SQL was run by hand). Nothing was changed. Do not delete anything; send the log of the `check` run to the developer assistant, who will prepare a safe reconciliation.
* **Red at "Apply pending migrations" with "PARTIALLY applied":** the migrations before the failing one are recorded and safe; the failing one was rolled back by D1; seeding and verification did not run. Read the error in the log, fix the cause (the developer assistant can do this from the log), then run the workflow again with `apply` — it continues with the remaining migrations.
* **Red at Seed:** migrations are complete. Fix the cause and re-run `apply` (seeds are idempotent).
* **Red at Verify:** read the `PROBLEM:` lines; do not ignore them.

### Verification status of this workflow
* ✅ The tooling logic (`scripts/production_db.py`) passes 33 tests (`scripts/production_db_test.py`) using a **fake wrangler** over a real SQLite file and the project's real migrations/seeds: fresh init, re-run, existing user data, untracked schema, unknown migrations, partial failure + rerun, failing seed, verification failures, secret hygiene, manual-only trigger.
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

## Cloudflare setup (not done yet — nothing below has been created)

**Resource names used by this project:** D1 database `thakbo-db`, R2 bucket `thakbo-media`, Worker `thakbo`. These names are only *configuration*: **no database or bucket exists until the owner creates them in their own Cloudflare account.** No database id, account id or key is stored in this repository.

### Option A — Cloudflare dashboard (works from a phone browser)
1. **D1:** dashboard → *Storage & Databases → D1 SQL database → Create* → name `thakbo-db`. Note its **Database ID**.
2. **R2:** *R2 object storage → Create bucket* → name `thakbo-media` (R2 may ask for a payment method to enable its free tier — check Cloudflare's current terms).
3. **Connect the Worker:** *Workers & Pages → Create → Import a repository* → choose your GitHub repo. Build command `npm run build`, deploy command `npx wrangler deploy`.
4. **Bind the database:** `wrangler.jsonc` needs the database id inside the `d1_databases` entry. Add one line `"database_id": "<your id>",` using GitHub's web editor (pencil icon) — or ask the developer assistant to do it for you if you send the id (the id is not a secret). *Unverified:* recent Wrangler versions can create missing resources automatically on deploy; if this works for you the step is unnecessary.
5. **Create the tables:** D1 → `thakbo-db` → *Console*: paste and run each file from `db/migrations/` **in order** (`0000` … `0005`), then optionally `db/seeds/0001_reference_data.sql` (safe to run twice).
6. **Secret:** Worker → *Settings → Variables and Secrets → Add* → `BETTER_AUTH_SECRET` = a long random text (type "Secret").
7. Open `https://<your-worker>/api/health` — expected `{"status":"ok","database":"ok"}`.

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
* Seed data: Bangladesh → Rajshahi (approximate city centre, area coordinates intentionally empty) + 14 facilities. **No fake users or listings.**
* All queries use bound parameters; the public search builder is unit-tested against injection.

## Better Auth decisions
* Better Auth handles password hashing, sessions and cookies. THAKBO contains no custom crypto.
* D1 is accessed through Kysely (`kysely-d1`); a new Better Auth instance is created per request because D1 bindings exist only during a request.
* Table columns are **camelCase** (`emailVerified`, `userId`, `expiresAt`, …) because that is what Better Auth's Kysely adapter uses by default. Dates are ISO text, booleans 0/1.
* **`tests/auth-schema.test.ts` compares migration `0000` with the columns the installed Better Auth version actually asks for**, so a mismatch is reported by CI instead of causing a runtime surprise.
* Sign-in/sign-up are rate-limited (5 per minute per rule), stored in D1 (`rateLimit` table). A profile row is created automatically for each new account.
* Password reset and e-mail verification are **not enabled** (they need an e-mail provider).

## Security summary
Server-side guards for `/dashboard/*` and `/admin/*` (admin role comes only from `admin_users`); owner checks in SQL (`getOwnedListing`); cross-site POST check; open-redirect-safe login redirects; security headers on every response; log redaction of passwords/tokens/cookies; no `dangerouslySetInnerHTML` (lint-enforced); image uploads (future) validated by real file bytes, type and size, with server-generated object keys. A strict Content-Security-Policy and rate limiting beyond sign-in are planned for Milestone 8.

## Remaining risks / known limitations
* Not yet verified by a real install/build (CI will show).
* Better Auth + D1 behaviour (D1 has no interactive transactions) has not been tested at runtime.
* `app/server/*` repository files rely on React Router removing server-only imports from browser bundles; if the build reports a "server-only module" error, the developer assistant must rename those modules to `*.server.ts`.
* Password reset, e-mail verification, contact form, image upload UI, map, favorites, reports and admin tools are not built (later milestones).
* Fields from the MVP spec such as room/bathroom counts and an "account status" are not in the schema yet.

## Milestones
1 Foundation ✅ · 2 Profiles, neighborhood-first locations, facilities, listing drafts (implemented, awaiting CI) · 3 R2 upload + listing wizard · 4 Map + search + radius · 5 Listing details, favorites, contact, reports · 6 User dashboard · 7 Admin + moderation · 8 SEO, polish, performance, security, deployment.

## Troubleshooting
* **Uploading `.github` from a phone:** some mobile browsers hide dot-folders. Use github.com's *Add file → Create new file* and type the path `.github/workflows/ci.yml`, pasting the file content; repeat for `generate-lockfile.yml`. Or ask for help — this can also be done in a free browser Codespace.
* **CI red at "Install dependencies":** copy the lines under "Show npm debug log (only if install failed)" and the failing step; send both to the developer assistant.
* **CI red at "Type-check", "Lint", "Unit tests" or "Production build":** copy the failing step's log.
* `Invalid server configuration ... BETTER_AUTH_SECRET` → set the secret (Cloudflare step 6).
* `no such table` → run the migrations (Cloudflare step 5).
