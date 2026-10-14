"""Applies every D1 migration and the seed (twice) to an in-memory SQLite database.
Fails (non-zero exit) on any SQL error, foreign-key problem, or non-idempotent seed. Needs only Python 3."""
import glob
import sqlite3
import sys
import re

con = sqlite3.connect(":memory:")
con.execute("PRAGMA foreign_keys=ON")
# Production D1 rejects long compound SELECT chains that normal SQLite accepts. Emulate a strict limit so a
# local pass means something (the old seed failed in production with "too many terms in compound SELECT").
con.setlimit(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT, 5)
migration_paths = sorted(glob.glob("db/migrations/*.sql"))
# Fail early if a migration is unnumbered, duplicated, or leaves a gap. Lexical ordering
# must match the order in which the D1 CLI and this verifier apply the files.
migration_names = [path.rsplit("/", 1)[-1] for path in migration_paths]
pattern = re.compile(r"^(\d{4})_[a-z0-9][a-z0-9_-]*\.sql$")
sequences = []
for name in migration_names:
    match = pattern.fullmatch(name)
    if not match:
        print(f"FAILED: invalid migration filename: {name}")
        sys.exit(1)
    sequences.append(int(match.group(1)))
expected = list(range(sequences[0], sequences[0] + len(sequences))) if sequences else []
if not sequences or sequences[0] != 0 or sequences != expected:
    print("FAILED: migration sequence must start at 0000 and be contiguous:", migration_names)
    sys.exit(1)
print("migration sequence:", ", ".join(migration_names))

for path in migration_paths:
    con.executescript(open(path, encoding="utf-8").read())
    print("applied", path)

# Migration 0010 is an audit-retention safety migration. Assert the expected guards
# exist in the resulting schema; behavioral checks remain in the Vitest suite.
expected_triggers = {
    "trg_listing_moderation_events_no_update",
    "trg_listing_moderation_events_no_delete",
    "trg_listings_audit_retention_guard",
}
actual_triggers = {row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type='trigger'")}
missing_triggers = sorted(expected_triggers - actual_triggers)
if missing_triggers:
    print("FAILED: expected audit-retention triggers missing:", missing_triggers)
    sys.exit(1)
print("audit-retention triggers present:", ", ".join(sorted(expected_triggers)))

counts = []
for run in (1, 2):
    for seed in sorted(glob.glob("db/seeds/*.sql")):
        con.executescript(open(seed, encoding="utf-8").read())
    counts.append(tuple(con.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in ("countries", "cities", "areas", "area_aliases", "facilities")))
    print(f"seed run {run}: countries/cities/areas/aliases/facilities =", counts[-1])

problems = con.execute("PRAGMA foreign_key_check").fetchall()
tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
print("tables:", len(tables))
if problems or counts[0] != counts[1]:
    print("FAILED: foreign key problems or seed is not idempotent", problems, counts)
    sys.exit(1)
print("SQL verification passed")
