import { z } from "zod";

/** Trimmed string that becomes `undefined` when empty (typical for optional HTML form fields). */
export const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

export const slugParam = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug");

export const uuidParam = z.uuid();

/** Flattens a Zod error into `{ fieldName: "first message" }` for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
