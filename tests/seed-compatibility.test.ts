import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compoundSelectProblems } from "./helpers/sql-compat";
import { createTestDatabase, loadSeeds, type TestDatabase } from "./helpers/sqlite-d1";

const root = new URL("../db/", import.meta.url);
const files = (folder: string) =>
  readdirSync(new URL(`${folder}/`, root)).filter((name) => name.endsWith(".sql")).sort();
const read = (folder: string, name: string) => readFileSync(new URL(`${folder}/${name}`, root), "utf8");

const counts = (db: TestDatabase) =>
  db.raw
    .prepare(
      `SELECT (SELECT count(*) FROM countries) AS countries, (SELECT count(*) FROM divisions) AS divisions,
              (SELECT count(*) FROM districts) AS districts, (SELECT count(*) FROM cities) AS cities,
              (SELECT count(*) FROM areas) AS areas, (SELECT count(*) FROM area_aliases) AS aliases,
              (SELECT count(*) FROM facilities) AS facilities`,
    )
    .get();

const EXPECTED = { countries: 1, divisions: 1, districts: 1, cities: 1, areas: 10, aliases: 25, facilities: 22 };

describe("D1 compatibility of seed and migration SQL (static check)", () => {
  it("flags the exact pattern that failed in production (a long UNION ALL chain)", () => {
    const chain = `INSERT OR IGNORE INTO areas (city_id, name, slug) SELECT 1, a.name, a.slug FROM (${Array.from({ length: 8 }, (_, i) => `SELECT 'n${i}' AS name, 's${i}' AS slug`).join(" UNION ALL ")}) a;`;
    expect(compoundSelectProblems(chain)).toContain("UNION (compound SELECT)");
    expect(compoundSelectProblems("SELECT 1 EXCEPT SELECT 2")).toContain("EXCEPT (compound SELECT)");
    expect(compoundSelectProblems("SELECT 1 INTERSECT SELECT 1")).toContain("INTERSECT (compound SELECT)");
  });

  it("flags VALUES lists with more than 5 rows and accepts 5", () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => `(${i})`).join(",");
    expect(compoundSelectProblems(`INSERT INTO t (a) VALUES ${rows(6)};`)).toHaveLength(1);
    expect(compoundSelectProblems(`INSERT INTO t (a) VALUES ${rows(5)};`)).toHaveLength(0);
  });

  it("ignores keywords inside comments and quoted text", () => {
    expect(compoundSelectProblems("-- UNION ALL\n/* EXCEPT */ INSERT INTO t (a) VALUES ('UNION; (x), (y)');")).toHaveLength(0);
  });

  it("finds no compound SELECT chain and no long VALUES list in any seed or migration file", () => {
    for (const folder of ["seeds", "migrations"]) {
      for (const name of files(folder)) expect(compoundSelectProblems(read(folder, name))).toEqual([]);
    }
  });

  it("keeps the words UNION / EXCEPT / INTERSECT out of the seed files completely", () => {
    for (const name of files("seeds")) expect(/\b(UNION|EXCEPT|INTERSECT)\b/i.test(read("seeds", name))).toBe(false);
  });

  it("has the expected seed files, in the required order", () => {
    expect(files("seeds")).toEqual(["0001_reference_data.sql", "0002_neighborhoods_and_facilities.sql"]);
  });
});

describe("seeds on a real SQLite database", () => {
  it("produce the expected Rajshahi reference data", () => {
    expect(counts(createTestDatabase())).toEqual(EXPECTED);
  });

  it("are idempotent: running them again and again creates no duplicates", () => {
    const db = createTestDatabase();
    loadSeeds(db.raw);
    loadSeeds(db.raw);
    loadSeeds(db.raw);
    expect(counts(db)).toEqual(EXPECTED);
    expect(db.raw.prepare("SELECT slug FROM areas GROUP BY city_id, slug HAVING count(*) > 1").all()).toEqual([]);
    expect(db.raw.prepare("SELECT normalized_alias FROM area_aliases GROUP BY city_id, normalized_alias HAVING count(*) > 1").all()).toEqual([]);
    expect(db.raw.prepare("SELECT slug FROM facilities GROUP BY slug HAVING count(*) > 1").all()).toEqual([]);
    expect(db.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("keep every neighborhood, alias and bilingual facility name", () => {
    const db = createTestDatabase();
    const slugs = (db.raw.prepare("SELECT slug FROM areas ORDER BY slug").all() as Array<{ slug: string }>).map((r) => r.slug);
    expect(slugs).toEqual(["binodpur", "ghoshpara", "hetem-khan", "kazla", "laxmipur", "motihar", "shaheb-bazar", "sopura", "talaimari", "upashahar"]);
    expect(db.raw.prepare("SELECT count(*) AS n FROM facilities WHERE name_bn IS NULL").get()).toMatchObject({ n: 0 });
    expect(db.raw.prepare("SELECT count(*) AS n FROM areas WHERE name_bn IS NULL OR search_priority = 0").get()).toMatchObject({ n: 0 });
    expect(db.raw.prepare("SELECT latitude, longitude FROM areas WHERE latitude IS NOT NULL").all()).toEqual([]);
  });

  it("repair a database that the failed production run left partly seeded", () => {
    const db = createTestDatabase({ seed: false });
    db.raw.exec(`
      INSERT INTO countries (name, slug, code) VALUES ('Bangladesh', 'bangladesh', 'BD');
      INSERT INTO divisions (country_id, name, slug) SELECT id, 'Rajshahi', 'rajshahi' FROM countries;
      INSERT INTO districts (division_id, name, slug) SELECT id, 'Rajshahi', 'rajshahi' FROM divisions;
      INSERT INTO cities (district_id, name, slug, latitude, longitude) SELECT id, 'Rajshahi', 'rajshahi', 24.3745, 88.6042 FROM districts;
      INSERT INTO areas (city_id, name, slug) SELECT id, 'Talaimari', 'talaimari' FROM cities;`);
    loadSeeds(db.raw);
    expect(counts(db)).toEqual(EXPECTED);
    expect(db.raw.prepare("SELECT latitude FROM cities").get()).toMatchObject({ latitude: 24.3745 });
  });
});
