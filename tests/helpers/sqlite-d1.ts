import { readdirSync, readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

/**
 * Test-only D1 stand-in backed by a REAL in-memory SQLite database (Node's built-in `node:sqlite`).
 * It applies the project's real migrations and seed files, so tests exercise the actual schema, constraints and SQL.
 * Only the D1 surface that app/server/db/client.ts uses is implemented: prepare().bind().all/first/run and batch().
 */

type Bindable = string | number | null;

interface SqliteModule {
  DatabaseSync: new (location: string) => DatabaseSync;
}

// getBuiltinModule avoids bundler resolution of the very new "node:sqlite" module.
const sqlite = process.getBuiltinModule("node:sqlite") as unknown as SqliteModule;

const MIGRATIONS_DIR = new URL("../../db/migrations/", import.meta.url);
const SEEDS_DIR = new URL("../../db/seeds/", import.meta.url);

class FakeStatement {
  readonly db: DatabaseSync;
  readonly sql: string;
  readonly values: Bindable[];

  constructor(db: DatabaseSync, sql: string, values: Bindable[] = []) {
    this.db = db;
    this.sql = sql;
    this.values = values;
  }

  bind(...values: unknown[]): FakeStatement {
    return new FakeStatement(this.db, this.sql, values.map((value) => (value === undefined ? null : (value as Bindable))));
  }

  all<T>(): Promise<{ results: T[]; success: true; meta: { changes: number } }> {
    const rows = this.db.prepare(this.sql).all(...this.values);
    return Promise.resolve({ results: rows.map((row) => ({ ...row }) as T), success: true, meta: { changes: 0 } });
  }

  first<T>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.values);
    return Promise.resolve(row ? ({ ...row } as T) : null);
  }

  run(): Promise<{ results: never[]; success: true; meta: { changes: number; last_row_id: number } }> {
    const info = this.db.prepare(this.sql).run(...this.values);
    return Promise.resolve({
      results: [],
      success: true,
      meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
    });
  }
}

class FakeD1 {
  readonly raw: DatabaseSync;

  constructor(raw: DatabaseSync) {
    this.raw = raw;
  }

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this.raw, sql);
  }

  /** Like D1: all statements succeed together or none are applied. */
  async batch(statements: FakeStatement[]) {
    this.raw.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.raw.exec("COMMIT");
      return results;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }
}

export interface TestDatabase {
  /** Pass this to repository/service functions. */
  d1: D1Database;
  /** Direct SQL access for arranging data and asserting results. */
  raw: DatabaseSync;
}

function fileName(url: URL): string {
  return url.pathname.split("/").pop() ?? "";
}

function sqlFiles(directory: URL): URL[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => new URL(name, directory));
}

/** A fresh database with every migration applied (and, by default, the seed data loaded). */
export function createTestDatabase(options: { seed?: boolean; stopBefore?: string } = {}): TestDatabase {
  const raw = new sqlite.DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  for (const file of sqlFiles(MIGRATIONS_DIR)) {
    if (options.stopBefore !== undefined && fileName(file).startsWith(options.stopBefore)) break;
    raw.exec(readFileSync(file, "utf8"));
  }
  if (options.seed ?? (options.stopBefore === undefined)) loadSeeds(raw);
  return { d1: new FakeD1(raw) as unknown as D1Database, raw };
}

/** Applies one migration file (by number prefix, e.g. "0007") to an existing test database. */
export function applyMigration(db: TestDatabase, prefix: string): void {
  const file = sqlFiles(MIGRATIONS_DIR).find((url) => fileName(url).startsWith(prefix));
  if (!file) throw new Error(`migration not found: ${prefix}`);
  db.raw.exec(readFileSync(file, "utf8"));
}

export function loadSeeds(raw: DatabaseSync): void {
  for (const file of sqlFiles(SEEDS_DIR)) raw.exec(readFileSync(file, "utf8"));
}

export function insertUser(db: TestDatabase, id: string, name: string = id): void {
  db.raw.prepare('INSERT INTO "user" (id, name, email) VALUES (?, ?, ?)').run(id, name, `${id}@example.test`);
}

/** Looks up a seeded id by slug (areas are looked up inside the Rajshahi city). */
export function seededAreaId(db: TestDatabase, slug: string): number {
  const row = db.raw.prepare("SELECT id FROM areas WHERE slug = ?").get(slug) as { id: number } | undefined;
  if (!row) throw new Error(`seed area missing: ${slug}`);
  return row.id;
}

export function seededCityId(db: TestDatabase, slug: string = "rajshahi"): number {
  const row = db.raw.prepare("SELECT id FROM cities WHERE slug = ?").get(slug) as { id: number } | undefined;
  if (!row) throw new Error(`seed city missing: ${slug}`);
  return row.id;
}

/** Adds a second city (with its own area) so cross-city rules can be tested. Returns both ids. */
export function insertSecondCity(db: TestDatabase): { cityId: number; areaId: number } {
  const district = db.raw.prepare("SELECT id FROM districts LIMIT 1").get() as { id: number };
  const city = db.raw
    .prepare("INSERT INTO cities (district_id, name, slug) VALUES (?, 'Testville', 'testville')")
    .run(district.id);
  const cityId = Number(city.lastInsertRowid);
  const area = db.raw
    .prepare("INSERT INTO areas (city_id, name, slug) VALUES (?, 'Testville Centre', 'testville-centre')")
    .run(cityId);
  return { cityId, areaId: Number(area.lastInsertRowid) };
}
