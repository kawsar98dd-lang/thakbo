import { readFileSync } from "node:fs";
import { getAuthTables } from "better-auth/db";
import { describe, expect, it } from "vitest";

/**
 * CONTRACT TEST: the columns Better Auth expects (for the INSTALLED Better Auth version and the options we use in
 * app/server/auth.server.ts) must all exist in migration 0000. If a Better Auth upgrade adds a column,
 * this test fails and tells us exactly which one is missing.
 */

const sql = readFileSync(new URL("../db/migrations/0000_better_auth.sql", import.meta.url), "utf8");

function columnsOf(table: string): Set<string> {
  const start = sql.indexOf(`CREATE TABLE "${table}" (`);
  if (start === -1) return new Set();
  const end = sql.indexOf("\n);", start);
  const block = sql.slice(start, end);
  const columns = [...block.matchAll(/^\s*"([A-Za-z]+)"\s+(?:TEXT|INTEGER)/gm)].map((m) => m[1] as string);
  return new Set(columns);
}

// Only options that influence the database schema are needed here (keep in sync with auth.server.ts).
const expectedTables = getAuthTables({
  emailAndPassword: { enabled: true },
  rateLimit: { enabled: true, storage: "database" },
});

describe("Better Auth schema contract (migration 0000)", () => {
  it("expects the four core tables plus the rate-limit table", () => {
    const names = Object.values(expectedTables).map((t) => t.modelName);
    expect(names).toEqual(expect.arrayContaining(["user", "session", "account", "verification", "rateLimit"]));
  });

  for (const table of Object.values(expectedTables)) {
    it(`table "${table.modelName}" has every column Better Auth expects`, () => {
      const present = columnsOf(table.modelName);
      expect(present.size, `table ${table.modelName} missing from migration 0000`).toBeGreaterThan(0);
      const expected = ["id", ...Object.entries(table.fields).map(([key, field]) => field.fieldName ?? key)];
      const missing = expected.filter((column) => !present.has(column));
      expect(missing, `columns missing in ${table.modelName}`).toEqual([]);
    });
  }
});
