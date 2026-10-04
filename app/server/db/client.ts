import { DatabaseError } from "../errors.server";
import { logger } from "../logger.server";

/** The only value types we ever bind. Always pass user input through here, never concatenate it into SQL. */
export type SqlValue = string | number | null;

async function run<T>(label: string, sql: string, task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    // Log the statement (without bound values) for debugging; users only ever see a generic message.
    logger.error("database operation failed", { label, sql, error });
    throw new DatabaseError("Database operation failed", { cause: error });
  }
}

export function queryAll<T>(db: D1Database, sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
  return run("queryAll", sql, async () => {
    const result = await db.prepare(sql).bind(...params).all<T>();
    return result.results;
  });
}

export function queryFirst<T>(db: D1Database, sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
  return run("queryFirst", sql, () => db.prepare(sql).bind(...params).first<T>());
}

export function execute(db: D1Database, sql: string, params: readonly SqlValue[] = []): Promise<D1Result> {
  return run("execute", sql, () => db.prepare(sql).bind(...params).run());
}

/**
 * D1 has no interactive transactions. `db.batch()` runs all statements atomically, so use it
 * whenever several writes must succeed or fail together (e.g. listing + facilities + audiences).
 */
export function batch(db: D1Database, statements: ReadonlyArray<{ sql: string; params?: readonly SqlValue[] }>) {
  return run("batch", statements.map((s) => s.sql).join(" ; "), () =>
    db.batch(statements.map((s) => db.prepare(s.sql).bind(...(s.params ?? [])))),
  );
}
