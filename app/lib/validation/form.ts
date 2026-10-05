/**
 * Turns submitted FormData into a plain object containing ONLY the listed fields (mass-assignment protection:
 * anything else a client sends — owner_id, status, role, slug — is never even read).
 * `multi` lists the fields that may carry several values (checkbox groups).
 */
export function formToObject(
  form: FormData,
  fields: readonly string[],
  multi: readonly string[] = [],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (multi.includes(field)) {
      result[field] = form.getAll(field).filter((value): value is string => typeof value === "string");
    } else {
      const value = form.get(field);
      result[field] = typeof value === "string" ? value : undefined;
    }
  }
  return result;
}

/** Raw submitted strings, used to re-fill a form after a validation error (files and unknown fields are ignored). */
export function formStrings(form: FormData, fields: readonly string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    const value = form.get(field);
    result[field] = typeof value === "string" ? value : "";
  }
  return result;
}
