"""Applies every D1 migration and the seed (twice) to an in-memory SQLite database.
Fails (non-zero exit) on any SQL error, foreign-key problem, or non-idempotent seed. Needs only Python 3."""
import glob
import sqlite3
import sys

con = sqlite3.connect(":memory:")
con.execute("PRAGMA foreign_keys=ON")
for path in sorted(glob.glob("db/migrations/*.sql")):
    con.executescript(open(path, encoding="utf-8").read())
    print("applied", path)

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
