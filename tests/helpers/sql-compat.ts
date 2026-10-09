/**
 * Static SQL compatibility check for production Cloudflare D1.
 *
 * WHY STATIC: production D1 rejects long compound SELECT chains ("too many terms in compound SELECT") that a normal
 * local SQLite (limit 500) happily runs, so "the seed works locally" proves nothing. The first production run failed
 * exactly like that: seed 0001 used an 8-term UNION ALL. The exact D1 limit is not documented in the sources used here,
 * so the rule is strict: no UNION / EXCEPT / INTERSECT at all, and at most MAX_VALUES_ROWS rows per VALUES list.
 * (Keep in sync with compound_select_problems() in scripts/production_db.py, which enforces the same rule in production.)
 */

export const MAX_VALUES_ROWS = 5;

/** Removes comments and replaces string literals with '' so keywords inside text are not mistaken for SQL. */
export function maskSql(sql: string): string {
  return sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'/g, (match) => (match.startsWith("'") ? "''" : " "));
}

function countValuesRows(masked: string, start: number): number {
  let depth = 0;
  let rows = 0;
  for (const char of masked.slice(start)) {
    if (char === "(") {
      if (depth === 0) rows += 1;
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (char === ";" && depth === 0) {
      break;
    }
  }
  return rows;
}

export function compoundSelectProblems(sql: string): string[] {
  const masked = maskSql(sql);
  const problems = [...new Set([...masked.matchAll(/\b(UNION|EXCEPT|INTERSECT)\b/gi)].map((m) => `${(m[1] ?? "").toUpperCase()} (compound SELECT)`))];
  for (const match of masked.matchAll(/\bVALUES\b/gi)) {
    const rows = countValuesRows(masked, (match.index ?? 0) + match[0].length);
    if (rows > MAX_VALUES_ROWS) problems.push(`VALUES list with ${rows} rows (maximum ${MAX_VALUES_ROWS})`);
  }
  return problems;
}
