#!/usr/bin/env python3
"""THAKBO — safe production D1 initialization (used ONLY by .github/workflows/initialize-production-db.yml).

Sub-commands (run in this order by the workflow):
  preflight   validate the repository, find the EXISTING database "thakbo-db", inspect its migration state
  migrate     apply pending migrations with `wrangler d1 migrations apply` (keeps wrangler's tracking table)
  seed        run the seed files, but only when every migration is applied
  verify      assert the expected production state (`--soft` reports problems without failing)
  cleanup     delete the temporary wrangler config

Safety rules enforced here (each one has a test in scripts/production_db_test.py):
  * Never creates, drops, resets or recreates a database. Only `d1 list`, `d1 execute` (read queries + the seed files)
    and `d1 migrations list/apply` are ever invoked, always with --remote against the database found by exact name.
  * Refuses to continue when the schema already exists WITHOUT migration tracking, when the tracking table contains
    unknown or out-of-order migrations, when the database name is missing or ambiguous, or when migration/seed files
    contain destructive SQL (the single allowed DROP is the audience-table rebuild in migration 0007).
  * Refuses SQL that production D1 cannot run: any UNION / EXCEPT / INTERSECT, and any VALUES list with more than 5 rows
    (production D1 rejects long compound SELECT chains — "too many terms in compound SELECT" — that a normal local
    SQLite accepts, so passing locally proves nothing; see compound_select_problems()).
  * Never prints environment variables. Secrets reach wrangler only through the process environment.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

DB_NAME = "thakbo-db"
BINDING = "DB"
MIGRATIONS_DIR = "db/migrations"
MIGRATIONS_TABLE = "d1_migrations"  # written into the temporary config, so it is explicit rather than assumed

EXPECTED_MIGRATIONS = [
    "0000_better_auth.sql",
    "0001_profiles_and_admin.sql",
    "0002_locations.sql",
    "0003_facilities.sql",
    "0004_listings.sql",
    "0005_favorites_and_reports.sql",
    "0006_neighborhood_locations.sql",
    "0007_facility_labels_and_audiences.sql",
]
SEED_FILES = [
    "db/seeds/0001_reference_data.sql",
    "db/seeds/0002_neighborhoods_and_facilities.sql",
]

REQUIRED_TABLES = [
    # Better Auth
    "user", "session", "account", "verification", "rateLimit",
    # THAKBO
    "profiles", "admin_users", "countries", "divisions", "districts", "cities", "areas", "area_aliases",
    "facilities", "listings", "listing_images", "listing_facilities", "listing_audiences", "favorites", "reports",
    MIGRATIONS_TABLE,
]

SEED_AREA_SLUGS = [
    "hetem-khan", "ghoshpara", "shaheb-bazar", "talaimari", "kazla", "motihar", "binodpur", "upashahar", "laxmipur", "sopura",
]
SEED_FACILITY_SLUGS = [
    "wifi", "meal", "attached-bathroom", "kitchen", "furniture", "parking", "lift", "generator-ips", "electricity",
    "water", "gas", "cctv", "security", "caretaker", "shared-bathroom", "furnished", "semi-furnished", "balcony",
    "dining", "fan", "ac", "washing-machine",
]
# normalized alias → canonical area slug (spellings listed in the product brief)
ALIAS_CHECKS = {
    "hetemkhan": "hetem-khan",
    "hatemkhan": "hetem-khan",
    "হেতেমখান": "hetem-khan",
    "হেটেমখান": "hetem-khan",
    "হাতেমখান": "hetem-khan",
    # "bazar" follows "b": normalization collapses the doubled Latin letter ("shaheb bazar" → "shahebazar")
    "shahebazar": "shaheb-bazar",
    "sahebazar": "shaheb-bazar",
    "সাহেববাজার": "shaheb-bazar",
}
MIN_ALIASES = 25

# The only destructive statement allowed in any migration: the rebuild of the small link table in 0007,
# which copies every row first (see the migration's comments).
ALLOWED_DROPS = {("0007_facility_labels_and_audiences.sql", "listing_audiences")}


class ToolError(Exception):
    """A condition that must stop the workflow. The message is shown to the owner."""


def repo_root() -> Path:
    return Path(os.environ.get("THAKBO_REPO_ROOT", Path(__file__).resolve().parent.parent)).resolve()


def config_path() -> Path:
    return Path(os.environ.get("THAKBO_WRANGLER_CONFIG", repo_root() / ".production-d1.wrangler.json"))


def say(message: str = "") -> None:
    print(message, flush=True)


def summary(lines: list[str]) -> None:
    target = os.environ.get("GITHUB_STEP_SUMMARY")
    if target:
        with open(target, "a", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")


# ---------------------------------------------------------------------------------------------------------------
# wrangler access
# ---------------------------------------------------------------------------------------------------------------

def wrangler(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    command = shlex.split(os.environ.get("WRANGLER", "npx --no-install wrangler")) + args
    env = dict(os.environ)
    env.update({"WRANGLER_SEND_METRICS": "false", "NO_COLOR": "1", "FORCE_COLOR": "0", "CI": "true"})
    result = subprocess.run(command, cwd=repo_root(), env=env, capture_output=True, text=True, check=False)
    if check and result.returncode != 0:
        # wrangler output never contains the API token; it is still truncated to keep logs readable.
        raise ToolError(
            f"wrangler {' '.join(args[:3])} failed (exit code {result.returncode}).\n"
            f"{(result.stdout + result.stderr).strip()[-3000:]}"
        )
    return result


def parse_json(text: str):
    """wrangler may print banner lines before the JSON; find the first parsable JSON array."""
    decoder = json.JSONDecoder()
    for match in re.finditer(r"\[", text):
        try:
            value, _ = decoder.raw_decode(text[match.start():])
        except json.JSONDecodeError:
            continue
        if isinstance(value, list):
            return value
    raise ToolError("Could not read wrangler's JSON output.")


def remote_args() -> list[str]:
    return ["--remote", "--config", str(config_path())]


def query(sql: str) -> list[dict]:
    """Runs ONE read-only statement (all SQL passed here is a constant in this file) and returns its rows."""
    result = wrangler(["d1", "execute", DB_NAME, *remote_args(), "--json", "--command", sql])
    sets = parse_json(result.stdout)
    if not sets or sets[0].get("success") is False:
        raise ToolError(f"Query failed: {sql}")
    return list(sets[0].get("results", []))


# ---------------------------------------------------------------------------------------------------------------
# repository checks
# ---------------------------------------------------------------------------------------------------------------

def strip_sql_comments(sql: str) -> str:
    return re.sub(r"--[^\n]*", "", sql)


# Production D1 allows far fewer terms in a compound SELECT than a normal SQLite build (500). The exact D1 limit is not
# documented in the sources used here, so the rule is deliberately strict: NO compound operators at all, and at most
# MAX_VALUES_ROWS rows per VALUES list (SQLite exempts VALUES from the compound limit, but the cap keeps even a stricter
# engine happy). Use several small INSERT ... VALUES statements instead.
MAX_VALUES_ROWS = 5

_SQL_NOISE = re.compile(r"--[^\n]*|/\*.*?\*/|'(?:[^']|'')*'", re.S)


def mask_sql(sql: str) -> str:
    """Removes comments and replaces string literals with '' so keywords inside text are never mistaken for SQL."""
    return _SQL_NOISE.sub(lambda m: "''" if m.group(0).startswith("'") else " ", sql)


def count_values_rows(masked: str, start: int) -> int:
    """Number of top-level (...) tuples after a VALUES keyword, up to the end of the statement."""
    depth = rows = 0
    for char in masked[start:]:
        if char == "(":
            if depth == 0:
                rows += 1
            depth += 1
        elif char == ")":
            depth -= 1
        elif char == ";" and depth == 0:
            break
    return rows


def compound_select_problems(sql: str) -> list[str]:
    masked = mask_sql(sql)
    problems = [f"{word.upper()} (compound SELECT)" for word in sorted({m.group(1).upper() for m in re.finditer(r"\b(UNION|EXCEPT|INTERSECT)\b", masked, re.I)})]
    for match in re.finditer(r"\bVALUES\b", masked, re.I):
        rows = count_values_rows(masked, match.end())
        if rows > MAX_VALUES_ROWS:
            problems.append(f"VALUES list with {rows} rows (maximum {MAX_VALUES_ROWS})")
    return problems


def migration_files() -> list[str]:
    folder = repo_root() / MIGRATIONS_DIR
    return sorted(path.name for path in folder.glob("*.sql"))


def check_repository() -> list[str]:
    """Returns the ordered migration list after validating files, order and SQL safety."""
    files = migration_files()
    if files[: len(EXPECTED_MIGRATIONS)] != EXPECTED_MIGRATIONS:
        raise ToolError(
            "Migration files do not match the required order.\n"
            f"  required first: {EXPECTED_MIGRATIONS}\n  found:          {files}"
        )
    for name in files:
        sql = strip_sql_comments((repo_root() / MIGRATIONS_DIR / name).read_text(encoding="utf-8"))
        if re.search(r"\bTRUNCATE\b", sql, re.I) or re.search(r"\bDELETE\s+FROM\b", sql, re.I):
            raise ToolError(f"{name}: destructive statement (DELETE/TRUNCATE) is not allowed in a production migration.")
        for problem in compound_select_problems(sql):
            raise ToolError(f"{name}: {problem} is not D1-compatible. Use several small INSERT ... VALUES statements.")
        for kind, table in re.findall(r"\bDROP\s+(TABLE|INDEX|VIEW|TRIGGER)\s+(?:IF\s+EXISTS\s+)?[\"`]?(\w+)", sql, re.I):
            if (name, table) not in ALLOWED_DROPS or kind.upper() != "TABLE":
                raise ToolError(f"{name}: DROP {kind} {table} is not allowed in a production migration.")
    for seed in SEED_FILES:
        path = repo_root() / seed
        if not path.is_file():
            raise ToolError(f"Seed file missing: {seed}")
        sql = strip_sql_comments(path.read_text(encoding="utf-8"))
        if re.search(r"\b(DROP|DELETE|TRUNCATE|ALTER)\b", sql, re.I):
            raise ToolError(f"{seed}: seed files must not contain DROP/DELETE/TRUNCATE/ALTER.")
        for problem in compound_select_problems(sql):
            raise ToolError(f"{seed}: {problem} is not D1-compatible (production D1 rejects long compound SELECTs). Use several small INSERT ... VALUES statements.")
    unlisted = sorted(p.name for p in (repo_root() / "db/seeds").glob("*.sql") if f"db/seeds/{p.name}" not in SEED_FILES)
    if unlisted:
        raise ToolError(f"Seed files not listed in SEED_FILES (would be silently skipped): {unlisted}")
    return files


def check_wrangler_config() -> None:
    """The committed wrangler.jsonc must still describe the D1 binding this workflow expects."""
    text = (repo_root() / "wrangler.jsonc").read_text(encoding="utf-8")
    for needle in (f'"binding": "{BINDING}"', f'"database_name": "{DB_NAME}"', f'"migrations_dir": "{MIGRATIONS_DIR}"'):
        if needle not in text:
            raise ToolError(f"wrangler.jsonc does not contain {needle}. Refusing to guess the production database.")
    if "database_id" in text and re.search(r'^\s*"database_id"', text, re.M):
        say("Note: wrangler.jsonc contains a database_id; it is NOT used by this workflow (the id is looked up by name).")


def require_credentials() -> None:
    for name in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"):
        if not os.environ.get(name, "").strip():
            raise ToolError(f"The GitHub secret {name} is missing or empty (Settings → Secrets and variables → Actions).")


# ---------------------------------------------------------------------------------------------------------------
# database state
# ---------------------------------------------------------------------------------------------------------------

def resolve_database_id() -> str:
    result = wrangler(["d1", "list", "--json"])
    matches = [db for db in parse_json(result.stdout) if db.get("name") == DB_NAME]
    if len(matches) != 1:
        raise ToolError(
            f'Expected exactly one existing D1 database named "{DB_NAME}", found {len(matches)}. '
            "Nothing was changed. Check the Cloudflare account id and the API token's D1 permission."
        )
    database_id = matches[0].get("uuid") or matches[0].get("id")
    if not database_id:
        raise ToolError("The database list did not include an id.")
    return str(database_id)


def write_config(database_id: str) -> None:
    config = {
        "name": "thakbo-production-d1-init",
        "compatibility_date": "2026-08-18",
        "d1_databases": [
            {
                "binding": BINDING,
                "database_name": DB_NAME,
                "database_id": database_id,
                "migrations_dir": MIGRATIONS_DIR,
                "migrations_table": MIGRATIONS_TABLE,
            }
        ],
    }
    config_path().write_text(json.dumps(config, indent=2), encoding="utf-8")


def inspect_remote(expected_files: list[str]) -> dict:
    tables = {row["name"] for row in query("SELECT name FROM sqlite_master WHERE type = 'table'")}
    user_tables = sorted(t for t in tables if not t.startswith(("sqlite_", "_cf_")) and t != MIGRATIONS_TABLE)
    if MIGRATIONS_TABLE not in tables:
        if user_tables:
            raise ToolError(
                "The database already contains tables but has NO migration tracking "
                f"({', '.join(user_tables[:8])}{'…' if len(user_tables) > 8 else ''}).\n"
                "This usually means the SQL was run by hand. The workflow will NOT guess and changed nothing.\n"
                "See README → 'Production database' → 'Database already contains tables'."
            )
        return {"state": "fresh", "applied": [], "pending": list(expected_files), "tables": tables}

    applied = [row["name"] for row in query(f"SELECT name FROM {MIGRATIONS_TABLE} ORDER BY id")]
    if applied != expected_files[: len(applied)]:
        raise ToolError(
            "The recorded migrations are unknown or out of order. Nothing was changed.\n"
            f"  recorded: {applied}\n  expected prefix of: {expected_files}"
        )
    return {"state": "tracked", "applied": applied, "pending": expected_files[len(applied):], "tables": tables}


def report_state(info: dict) -> None:
    say(f"Database state : {info['state']}")
    say(f"Applied        : {len(info['applied'])} → {info['applied']}")
    say(f"Pending        : {len(info['pending'])} → {info['pending']}")


# ---------------------------------------------------------------------------------------------------------------
# sub-commands
# ---------------------------------------------------------------------------------------------------------------

def cmd_preflight() -> None:
    require_credentials()
    files = check_repository()
    check_wrangler_config()
    say(f"Repository OK: {len(files)} migrations in the required order, {len(SEED_FILES)} seed files, no destructive SQL.")
    say("wrangler version: " + wrangler(["--version"]).stdout.strip().splitlines()[-1])
    database_id = resolve_database_id()
    say(f'Found the existing D1 database "{DB_NAME}" (it will not be created, dropped or reset).')
    write_config(database_id)
    info = inspect_remote(files)
    report_state(info)
    summary(["### Production D1 — current state", f"- state: **{info['state']}**",
             f"- applied migrations: {len(info['applied'])}", f"- pending migrations: {len(info['pending'])}"])


def require_config() -> None:
    if not config_path().is_file():
        raise ToolError("Run the 'preflight' step first (temporary configuration is missing).")


def cmd_migrate() -> None:
    require_credentials()
    require_config()
    files = check_repository()
    info = inspect_remote(files)
    report_state(info)
    if not info["pending"]:
        say("Nothing to apply: every migration is already recorded.")
        return
    say("Pending migrations according to wrangler:")
    say(wrangler(["d1", "migrations", "list", DB_NAME, *remote_args()]).stdout.strip())
    say("Applying pending migrations (each file is applied as one all-or-nothing batch by D1)…")
    applied = wrangler(["d1", "migrations", "apply", DB_NAME, *remote_args()], check=False)
    say((applied.stdout + applied.stderr).strip()[-3000:])
    after = inspect_remote(files)
    report_state(after)
    if applied.returncode != 0 or after["pending"]:
        raise ToolError(
            "Migrations are only PARTIALLY applied. Seeding and verification were NOT run.\n"
            "Read the error above, then run this workflow again: already-applied migrations are skipped "
            "and the remaining ones continue (see README → 'If a run fails')."
        )
    say("All migrations applied.")


def cmd_seed() -> None:
    require_credentials()
    require_config()
    files = check_repository()
    info = inspect_remote(files)
    if info["pending"]:
        raise ToolError(f"{len(info['pending'])} migration(s) are still pending. Seeds are NOT run before every migration succeeded.")
    for seed in SEED_FILES:
        say(f"Running seed (idempotent): {seed}")
        result = wrangler(["d1", "execute", DB_NAME, *remote_args(), "--file", seed], check=False)
        say((result.stdout + result.stderr).strip()[-1500:])
        if result.returncode != 0:
            raise ToolError(f"Seed {seed} failed. Later seeds and verification were NOT run. Fix the cause and re-run (seeds are idempotent).")
    say("Seeds completed.")


def count_row(row: dict, key: str) -> int:
    return int(row.get(key, 0))


def collect_problems(files: list[str]) -> tuple[list[str], list[str]]:
    """Returns (problems, report lines). Problems are conditions that make production state unacceptable."""
    problems: list[str] = []
    report: list[str] = []

    tables = {row["name"] for row in query("SELECT name FROM sqlite_master WHERE type = 'table'")}
    if MIGRATIONS_TABLE not in tables:
        report.append("migrations recorded: 0 (no tracking table yet)")
        problems.append("migration status: no migrations have been applied yet")
        return problems, report

    applied = [row["name"] for row in query(f"SELECT name FROM {MIGRATIONS_TABLE} ORDER BY id")]
    report.append(f"migrations recorded: {len(applied)}/{len(files)}")
    if applied != files:
        problems.append(f"migration status: recorded {applied}, expected {files}")

    missing = [t for t in REQUIRED_TABLES if t not in tables]
    report.append(f"required tables present: {len(REQUIRED_TABLES) - len(missing)}/{len(REQUIRED_TABLES)}")
    if missing:
        problems.append(f"missing tables (Better Auth / THAKBO): {missing}")
        return problems, report  # the remaining queries would only produce noise

    counts = query(
        "SELECT (SELECT count(*) FROM countries) AS countries, (SELECT count(*) FROM divisions) AS divisions, "
        "(SELECT count(*) FROM districts) AS districts, (SELECT count(*) FROM cities) AS cities"
    )[0]
    report.append("countries/divisions/districts/cities: " + "/".join(str(count_row(counts, k)) for k in ("countries", "divisions", "districts", "cities")))
    for key in ("countries", "divisions", "districts", "cities"):
        if count_row(counts, key) < 1:
            problems.append(f"{key} is empty (expected at least 1)")
    if "BD" not in {row["code"] for row in query("SELECT code FROM countries")}:
        problems.append("country BD (Bangladesh) not found")
    if "rajshahi" not in {row["slug"] for row in query("SELECT slug FROM divisions")}:
        problems.append("division 'rajshahi' not found")
    if "rajshahi" not in {row["slug"] for row in query("SELECT slug FROM districts")}:
        problems.append("district 'rajshahi' not found")
    cities = query("SELECT slug, name_bn FROM cities WHERE slug = 'rajshahi'")
    if not cities:
        problems.append("city 'rajshahi' not found")
    elif not cities[0].get("name_bn"):
        problems.append("city 'rajshahi' has no Bangla name (seed 0002 not applied?)")

    areas = {row["slug"] for row in query(
        "SELECT a.slug AS slug FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.is_active = 1")}
    report.append(f"Rajshahi active areas: {len(areas)} (required: {len(SEED_AREA_SLUGS)} seeded ones)")
    if not set(SEED_AREA_SLUGS) <= areas:
        problems.append(f"Rajshahi areas missing: {sorted(set(SEED_AREA_SLUGS) - areas)}")

    alias_rows = query(
        "SELECT al.normalized_alias AS k, a.slug AS slug FROM area_aliases al JOIN areas a ON a.id = al.area_id "
        "JOIN cities c ON c.id = al.city_id WHERE c.slug = 'rajshahi'")
    report.append(f"Rajshahi aliases: {len(alias_rows)} (required at least {MIN_ALIASES})")
    if len(alias_rows) < MIN_ALIASES:
        problems.append(f"only {len(alias_rows)} Rajshahi aliases, expected at least {MIN_ALIASES}")
    resolved = {row["k"]: row["slug"] for row in alias_rows}
    wrong = {k: resolved.get(k) for k, slug in ALIAS_CHECKS.items() if resolved.get(k) != slug}
    if wrong:
        problems.append(f"alias resolution wrong or missing (alias → found): {wrong}")

    facilities = {row["slug"]: row for row in query("SELECT slug, name_bn, is_active FROM facilities")}
    missing_fac = [s for s in SEED_FACILITY_SLUGS if s not in facilities]
    no_bn = [s for s in SEED_FACILITY_SLUGS if s in facilities and not facilities[s].get("name_bn")]
    report.append(f"facilities: {len(facilities)} (seeded ones present: {len(SEED_FACILITY_SLUGS) - len(missing_fac)}/{len(SEED_FACILITY_SLUGS)})")
    if missing_fac:
        problems.append(f"facilities missing: {missing_fac}")
    if no_bn:
        problems.append(f"facilities without Bangla label: {no_bn}")

    violations = query("PRAGMA foreign_key_check")
    report.append(f"foreign key violations: {len(violations)}")
    if violations:
        problems.append(f"foreign key violations found: {len(violations)}")

    live = query("SELECT (SELECT count(*) FROM \"user\") AS users, (SELECT count(*) FROM listings) AS listings")[0]
    report.append(f"informational: users={count_row(live, 'users')}, listings={count_row(live, 'listings')} (never modified by this workflow)")
    return problems, report


def cmd_verify(soft: bool) -> None:
    require_credentials()
    require_config()
    files = check_repository()
    problems, report = collect_problems(files)
    for line in report:
        say("  " + line)
    summary(["### Production D1 — verification"] + [f"- {line}" for line in report])
    if problems:
        say("")
        for problem in problems:
            say("  PROBLEM: " + problem)
        summary(["", "**Problems:**"] + [f"- {p}" for p in problems])
        if soft:
            say("(check mode: problems are reported, nothing was changed)")
            return
        raise ToolError("Verification failed: the production database is not in the expected state.")
    say("Verification passed.")
    summary(["", "**Verification passed.**"])


def cmd_cleanup() -> None:
    path = config_path()
    if path.exists():
        path.unlink()
        say("Temporary configuration removed.")


def main(argv: list[str]) -> int:
    commands = {"preflight": cmd_preflight, "migrate": cmd_migrate, "seed": cmd_seed, "cleanup": cmd_cleanup}
    if len(argv) < 2 or argv[1] not in {*commands, "verify"}:
        say(__doc__ or "")
        return 2
    try:
        if argv[1] == "verify":
            cmd_verify(soft="--soft" in argv[2:])
        else:
            commands[argv[1]]()
    except ToolError as error:
        say(f"\nERROR: {error}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
