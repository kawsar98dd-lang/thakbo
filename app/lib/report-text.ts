/** Normalize user-supplied moderation text before storing it. */
export function normalizeReportText(value: string): string {
  return value
    // Remove control characters except ordinary whitespace, then normalize line endings.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}
