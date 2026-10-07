#!/usr/bin/env python3
"""Tests for scripts/production_db.py using a FAKE `wrangler` backed by a real SQLite file.

What this proves: the tool's own logic (ordering, state detection, refusal rules, partial-failure handling,
idempotent re-runs, verification, secret hygiene) on the project's REAL migrations and seeds.
What it cannot prove: how the real wrangler / Cloudflare D1 behave. That is only exercised by the real workflow run.
Run:  python3 scripts/production_db_test.py
"""

from __future__ import annotations

import io
import json
import os
import re
import shutil
import sqlite3
import stat
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
import production_db as tool  # noqa: E402

SECRET = "SECRET-TOKEN-VALUE-12345"

FAKE_WRANGLER = r'''#!/usr/bin/env python3
import json, os, sqlite3, sys
from pathlib import Path

args = sys.argv[1:]
log = os.environ.get("FAKE_D1_LOG")
if log:
    with open(log, "a") as handle:
        handle.write(json.dumps(args) + "\n")

def flag(name):
    return args[args.index(name) + 1] if name in args else None

if args == ["--version"]:
    print("fake-wrangler 0.0.0"); sys.exit(0)
if args[:2] == ["d1", "list"]:
    default = [{"uuid": "11111111-2222-4333-8444-555555555555", "name": "thakbo-db"}]
    print(json.dumps(json.loads(os.environ.get("FAKE_D1_LIST", json.dumps(default))))); sys.exit(0)
if args[0] != "d1" or args[1] not in ("execute", "migrations"):
    print("fake wrangler: refusing unexpected command " + " ".join(args)); sys.exit(2)
if "--remote" not in args:
    print("fake wrangler: every command must use --remote"); sys.exit(2)

cfg = json.loads(Path(flag("--config")).read_text())["d1_databases"][0]
assert cfg["database_id"] and cfg["database_name"] == "thakbo-db" and cfg["migrations_table"]
con = sqlite3.connect(os.environ["FAKE_D1_DB"])
con.row_factory = sqlite3.Row
con.execute("PRAGMA foreign_keys = ON")

if args[1] == "execute":
    if "--command" in args:
        rows = [dict(r) for r in con.execute(flag("--command")).fetchall()]
        print(json.dumps([{"results": rows, "success": True, "meta": {}}]))
    else:
        con.executescript(Path(flag("--file")).read_text())
    sys.exit(0)

table = cfg["migrations_table"]
folder = Path(cfg["migrations_dir"])
exists = con.execute("SELECT 1 FROM sqlite_master WHERE name = ?", (table,)).fetchone()
done = {r["name"] for r in con.execute(f"SELECT name FROM {table}")} if exists else set()
pending = [p for p in sorted(folder.glob("*.sql")) if p.name not in done]
if args[2] == "list":
    print("No migrations to apply!" if not pending else "Migrations to be applied: " + ", ".join(p.name for p in pending))
    sys.exit(0)
con.execute(f"CREATE TABLE IF NOT EXISTS {table} (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT)")
for path in pending:
    if os.environ.get("FAKE_D1_FAIL_AT") and path.name.startswith(os.environ["FAKE_D1_FAIL_AT"]):
        print("ERROR: simulated failure in " + path.name); sys.exit(1)
    con.executescript(path.read_text())
    con.execute(f"INSERT INTO {table} (name, applied_at) VALUES (?, datetime('now'))", (path.name,))
    con.commit()
print("All migrations applied")
'''


class ToolTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.temp, ignore_errors=True)
        self.root = self.temp / "repo"
        shutil.copytree(REPO / "db", self.root / "db")
        shutil.copy(REPO / "wrangler.jsonc", self.root / "wrangler.jsonc")
        fake = self.temp / "wrangler"
        fake.write_text(FAKE_WRANGLER)
        fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
        self.db = self.temp / "remote.sqlite"
        self.log = self.temp / "calls.jsonl"
        self.env = {
            "THAKBO_REPO_ROOT": str(self.root),
            "WRANGLER": f"{sys.executable} {fake}",
            "FAKE_D1_DB": str(self.db),
            "FAKE_D1_LOG": str(self.log),
            "CLOUDFLARE_API_TOKEN": SECRET,
            "CLOUDFLARE_ACCOUNT_ID": "acct-0000",
        }
        self.saved = {k: os.environ.get(k) for k in [*self.env, "FAKE_D1_LIST", "FAKE_D1_FAIL_AT", "GITHUB_STEP_SUMMARY"]}
        os.environ.update(self.env)
        for key in ("FAKE_D1_LIST", "FAKE_D1_FAIL_AT", "GITHUB_STEP_SUMMARY"):
            os.environ.pop(key, None)
        self.addCleanup(self.restore_env)
        self.output = ""

    def restore_env(self) -> None:
        for key, value in self.saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def run_tool(self, *args: str) -> int:
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            code = tool.main(["production_db.py", *args])
        self.output += buffer.getvalue()
        return code

    def full_run(self) -> list[int]:
        return [self.run_tool(step) for step in ("preflight", "migrate", "seed")] + [self.run_tool("verify")]

    def sql(self, statement: str):
        con = sqlite3.connect(self.db)
        try:
            return con.execute(statement).fetchall()
        finally:
            con.close()

    def calls(self) -> list[list[str]]:
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []


class RepositoryRules(ToolTestCase):
    def test_expected_order_matches_the_repository(self) -> None:
        self.assertEqual(tool.migration_files(), tool.EXPECTED_MIGRATIONS)
        for seed in tool.SEED_FILES:
            self.assertTrue((self.root / seed).is_file())

    def test_wrong_migration_order_is_refused(self) -> None:
        (self.root / "db/migrations/0003_facilities.sql").rename(self.root / "db/migrations/0003a_facilities.sql")
        self.assertEqual(self.run_tool("preflight"), 1)
        self.assertIn("required order", self.output)
        self.assertEqual(self.calls(), [])  # nothing was sent to wrangler

    def test_destructive_sql_is_refused_in_migrations_and_seeds(self) -> None:
        bad_migration = self.root / "db/migrations/0008_bad.sql"
        bad_migration.write_text("DROP TABLE listings;\n")
        self.assertEqual(self.run_tool("preflight"), 1)
        self.assertIn("not allowed", self.output)
        bad_migration.unlink()
        (self.root / "db/seeds/0002_neighborhoods_and_facilities.sql").write_text("DELETE FROM areas;\n")
        self.output = ""
        self.assertEqual(self.run_tool("preflight"), 1)
        self.assertIn("seed files must not contain", self.output)

    def test_comments_do_not_trigger_the_destructive_check_but_the_real_0007_drop_is_allowed(self) -> None:
        (self.root / "db/migrations/0008_note.sql").write_text("-- nothing is dropped here: DROP TABLE x; DELETE FROM y\nSELECT 1;\n")
        self.assertEqual(self.run_tool("preflight"), 0)

    def test_wrangler_config_must_still_describe_the_expected_binding(self) -> None:
        text = (self.root / "wrangler.jsonc").read_text().replace('"database_name": "thakbo-db"', '"database_name": "other-db"')
        (self.root / "wrangler.jsonc").write_text(text)
        self.assertEqual(self.run_tool("preflight"), 1)
        self.assertIn("Refusing to guess", self.output)

    def test_missing_credentials_stop_everything(self) -> None:
        os.environ["CLOUDFLARE_API_TOKEN"] = ""
        self.assertEqual(self.run_tool("preflight"), 1)
        self.assertIn("CLOUDFLARE_API_TOKEN", self.output)
        self.assertEqual(self.calls(), [])


class DatabaseLookup(ToolTestCase):
    def test_missing_database_is_never_created(self) -> None:
        os.environ["FAKE_D1_LIST"] = json.dumps([{"uuid": "x", "name": "something-else"}])
        self.assertEqual(self.run_tool("preflight"), 1)
        self.assertIn("exactly one existing D1 database", self.output)
        self.assertFalse(self.db.exists())

    def test_ambiguous_database_name_is_refused(self) -> None:
        os.environ["FAKE_D1_LIST"] = json.dumps([{"uuid": "a", "name": "thakbo-db"}, {"uuid": "b", "name": "thakbo-db"}])
        self.assertEqual(self.run_tool("preflight"), 1)

    def test_only_safe_wrangler_commands_are_ever_used(self) -> None:
        self.assertEqual(self.full_run(), [0, 0, 0, 0])
        allowed = ({"d1", "list"}, {"d1", "execute"}, {"d1", "migrations"})
        for call in self.calls():
            if call == ["--version"]:
                continue
            self.assertIn(set(call[:2]), allowed)
            self.assertNotIn("create", call)
            self.assertNotIn("delete", call)
            self.assertNotIn("--local", call)
            if call[1] in ("execute", "migrations"):
                self.assertIn("--remote", call)


class FreshInitialization(ToolTestCase):
    def test_fresh_database_is_initialized_and_verified(self) -> None:
        self.assertEqual(self.full_run(), [0, 0, 0, 0])
        self.assertIn("Database state : fresh", self.output)
        self.assertIn("All migrations applied.", self.output)
        self.assertIn("Verification passed.", self.output)
        names = [r[0] for r in self.sql("SELECT name FROM d1_migrations ORDER BY id")]
        self.assertEqual(names, tool.EXPECTED_MIGRATIONS)
        self.assertEqual(self.sql("SELECT count(*) FROM areas")[0][0], 10)
        self.assertEqual(self.sql("SELECT count(*) FROM area_aliases")[0][0], 25)
        self.assertEqual(self.sql("SELECT count(*) FROM facilities")[0][0], 22)

    def test_seeds_run_only_after_all_migrations_and_in_order(self) -> None:
        self.full_run()
        executed = [c for c in self.calls() if c[:2] == ["d1", "execute"] and "--file" in c]
        self.assertEqual([c[c.index("--file") + 1] for c in executed], tool.SEED_FILES)
        calls = self.calls()
        apply_index = next(i for i, c in enumerate(calls) if c[:3] == ["d1", "migrations", "apply"])
        first_seed = next(i for i, c in enumerate(calls) if "--file" in c)
        self.assertLess(apply_index, first_seed)

    def test_rerunning_the_whole_workflow_is_safe_and_changes_nothing(self) -> None:
        self.full_run()
        before = {t: self.sql(f"SELECT * FROM {t} ORDER BY 1, 2") for t in ("areas", "area_aliases", "facilities", "d1_migrations")}
        self.output = ""
        self.assertEqual(self.full_run(), [0, 0, 0, 0])
        self.assertIn("Nothing to apply", self.output)
        after = {t: self.sql(f"SELECT * FROM {t} ORDER BY 1, 2") for t in before}
        self.assertEqual(before, after)
        applies = [c for c in self.calls() if c[:3] == ["d1", "migrations", "apply"]]
        self.assertEqual(len(applies), 1)  # the second run did not even call apply

    def test_existing_user_data_survives_a_rerun(self) -> None:
        self.full_run()
        con = sqlite3.connect(self.db)
        con.execute("INSERT INTO \"user\" (id, name, email) VALUES ('u1', 'Real User', 'real@example.test')")
        con.execute("INSERT INTO profiles (user_id, display_name) VALUES ('u1', 'Real User')")
        con.commit()
        con.close()
        self.assertEqual(self.full_run(), [0, 0, 0, 0])
        self.assertEqual(self.sql("SELECT count(*) FROM \"user\"")[0][0], 1)
        self.assertEqual(self.sql("SELECT display_name FROM profiles")[0][0], "Real User")


class RefusalsAndFailures(ToolTestCase):
    def test_schema_without_tracking_is_refused_and_untouched(self) -> None:
        con = sqlite3.connect(self.db)
        con.executescript((self.root / "db/migrations/0000_better_auth.sql").read_text())
        con.close()
        self.assertEqual(self.run_tool("preflight"), 1)
        self.assertIn("NO migration tracking", self.output)
        self.assertEqual(self.sql("SELECT count(*) FROM sqlite_master WHERE name = 'd1_migrations'")[0][0], 0)
        self.assertEqual([c for c in self.calls() if "apply" in c], [])

    def test_unknown_recorded_migrations_are_refused(self) -> None:
        con = sqlite3.connect(self.db)
        con.execute("CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, applied_at TEXT)")
        con.execute("INSERT INTO d1_migrations (name) VALUES ('0003_facilities.sql')")
        con.commit()
        con.close()
        self.assertEqual(self.run_tool("preflight"), 1)
        self.assertIn("unknown or out of order", self.output)

    def test_partial_failure_stops_seeding_and_a_rerun_completes_the_rest(self) -> None:
        os.environ["FAKE_D1_FAIL_AT"] = "0004"
        self.assertEqual(self.run_tool("preflight"), 0)
        self.assertEqual(self.run_tool("migrate"), 1)
        self.assertIn("PARTIALLY applied", self.output)
        self.assertEqual([r[0] for r in self.sql("SELECT name FROM d1_migrations ORDER BY id")], tool.EXPECTED_MIGRATIONS[:4])
        # the next steps refuse to run
        self.assertEqual(self.run_tool("seed"), 1)
        self.assertIn("still pending", self.output)
        self.assertEqual([c for c in self.calls() if "--file" in c], [])
        self.assertEqual(self.run_tool("verify"), 1)
        # fix the cause, run again: remaining migrations continue
        del os.environ["FAKE_D1_FAIL_AT"]
        self.output = ""
        self.assertEqual(self.full_run(), [0, 0, 0, 0])
        self.assertIn("Database state : tracked", self.output)
        self.assertEqual(len(self.sql("SELECT name FROM d1_migrations")), 8)

    def test_a_failing_seed_stops_before_verification(self) -> None:
        self.run_tool("preflight")
        self.run_tool("migrate")
        (self.root / "db/seeds/0002_neighborhoods_and_facilities.sql").write_text("INSERT INTO no_such_table VALUES (1);\n")
        self.assertEqual(self.run_tool("seed"), 1)

    def test_commands_refuse_to_run_without_preflight(self) -> None:
        for step in ("migrate", "seed", "verify"):
            self.assertEqual(self.run_tool(step), 1)
        self.assertIn("preflight", self.output)


class Verification(ToolTestCase):
    def initialized(self) -> None:
        self.assertEqual(self.full_run(), [0, 0, 0, 0])

    def test_missing_alias_fails_verification(self) -> None:
        self.initialized()
        con = sqlite3.connect(self.db)
        con.execute("DELETE FROM area_aliases WHERE normalized_alias = 'hatemkhan'")
        con.commit()
        con.close()
        self.output = ""
        self.assertEqual(self.run_tool("verify"), 1)
        self.assertIn("alias resolution wrong or missing", self.output)

    def test_missing_better_auth_table_fails_verification(self) -> None:
        self.initialized()
        con = sqlite3.connect(self.db)
        con.execute("PRAGMA foreign_keys = OFF")
        con.execute("DROP TABLE \"rateLimit\"")
        con.commit()
        con.close()
        self.output = ""
        self.assertEqual(self.run_tool("verify"), 1)
        self.assertIn("rateLimit", self.output)

    def test_missing_area_and_facility_fail_verification(self) -> None:
        self.initialized()
        con = sqlite3.connect(self.db)
        con.execute("UPDATE areas SET is_active = 0 WHERE slug = 'ghoshpara'")
        con.execute("UPDATE facilities SET name_bn = NULL WHERE slug = 'wifi'")
        con.commit()
        con.close()
        self.output = ""
        self.assertEqual(self.run_tool("verify"), 1)
        self.assertIn("Rajshahi areas missing", self.output)
        self.assertIn("without Bangla label", self.output)

    def test_growth_after_launch_does_not_break_verification(self) -> None:
        self.initialized()
        con = sqlite3.connect(self.db)
        con.execute("INSERT INTO cities (district_id, name, slug) VALUES (1, 'Dhaka', 'dhaka')")
        con.execute("INSERT INTO facilities (name, slug) VALUES ('Sauna', 'sauna')")
        con.commit()
        con.close()
        self.assertEqual(self.run_tool("verify"), 0)

    def test_soft_mode_reports_a_fresh_database_without_failing_or_writing(self) -> None:
        self.assertEqual(self.run_tool("preflight"), 0)
        self.assertEqual(self.run_tool("verify", "--soft"), 0)
        self.assertIn("PROBLEM: migration status", self.output)
        self.assertEqual([c for c in self.calls() if "apply" in c or "--file" in c], [])

    def test_soft_mode_still_fails_when_the_state_is_unsafe(self) -> None:
        con = sqlite3.connect(self.db)
        con.executescript((self.root / "db/migrations/0000_better_auth.sql").read_text())
        con.close()
        self.assertEqual(self.run_tool("preflight"), 1)


class SecretsAndCleanup(ToolTestCase):
    def test_secrets_never_appear_in_output_summary_or_temporary_config(self) -> None:
        summary = self.temp / "summary.md"
        os.environ["GITHUB_STEP_SUMMARY"] = str(summary)
        self.full_run()
        config_text = tool.config_path().read_text()
        for text in (self.output, summary.read_text(), config_text):
            self.assertNotIn(SECRET, text)
            self.assertNotIn("acct-0000", text)

    def test_cleanup_removes_the_temporary_config(self) -> None:
        self.run_tool("preflight")
        self.assertTrue(tool.config_path().exists())
        self.assertEqual(self.run_tool("cleanup"), 0)
        self.assertFalse(tool.config_path().exists())
        self.assertEqual(self.run_tool("cleanup"), 0)

    def test_the_temporary_config_is_git_ignored(self) -> None:
        ignore = (REPO / ".gitignore").read_text()
        self.assertIn(".production-d1.wrangler.json", ignore)


class WorkflowFile(unittest.TestCase):
    raw = (REPO / ".github/workflows/initialize-production-db.yml").read_text()
    # comments explain the file to humans; the checks below look at the executable content only
    text = "\n".join(line for line in raw.splitlines() if not line.lstrip().startswith("#"))

    def test_trigger_is_manual_only(self) -> None:
        on_block = self.text.split("\njobs:")[0]
        self.assertIn("workflow_dispatch:", on_block)
        for forbidden in ("push:", "pull_request", "schedule:", "workflow_run", "repository_dispatch", "release:"):
            self.assertNotIn(forbidden, on_block)

    def test_secrets_are_only_referenced_by_name_and_never_echoed(self) -> None:
        self.assertIn("secrets.CLOUDFLARE_API_TOKEN", self.text)
        self.assertIn("secrets.CLOUDFLARE_ACCOUNT_ID", self.text)
        for line in self.text.splitlines():
            if re.search(r"\becho\b|\bprintf\b|\bcat\b|\benv\b|\bprintenv\b|\bset -x\b", line):
                self.assertNotIn("${{ secrets.", line)
                self.assertNotIn("$CLOUDFLARE_API_TOKEN", line)
                self.assertNotIn("$CLOUDFLARE_ACCOUNT_ID", line)

    def test_secrets_are_only_given_to_the_production_steps(self) -> None:
        steps = self.text.split("\n      - name: ")[1:]
        for step in steps:
            title = step.splitlines()[0]
            if "secrets.CLOUDFLARE_API_TOKEN" in step and "env:" in step and "HAS_TOKEN" not in step:
                self.assertIn("production_db.py", step, f"secret exposed to a non-production step: {title}")

    def test_no_destructive_or_creating_wrangler_commands(self) -> None:
        for forbidden in ("d1 create", "d1 delete", "d1 time-travel", "--local", "wrangler deploy", "DROP ", "DELETE FROM"):
            self.assertNotIn(forbidden, self.text)

    def test_steps_run_in_the_required_order_and_apply_is_guarded(self) -> None:
        order = ["production_db.py preflight", "production_db.py migrate", "production_db.py seed", "production_db.py verify\n"]
        positions = [self.text.index(item) for item in order]
        self.assertEqual(positions, sorted(positions))
        self.assertIn("refs/heads/main", self.text)
        self.assertIn('"$CONFIRM" != "THAKBO-DB"', self.text)
        for name in ("2. Apply pending migrations", "3. Seed reference data", "4. Verify production state"):
            step = self.text.split(name)[1].split("\n      - name:")[0]
            self.assertIn("inputs.mode == 'apply'", step)

    def test_ci_workflow_is_not_modified_to_deploy_or_touch_production(self) -> None:
        ci = (REPO / ".github/workflows/ci.yml").read_text()
        self.assertNotIn("CLOUDFLARE_API_TOKEN", ci)
        self.assertNotIn("production_db.py migrate", ci)
        self.assertNotIn("workflow_dispatch" + "\n  schedule", ci)


if __name__ == "__main__":
    unittest.main(verbosity=1)
