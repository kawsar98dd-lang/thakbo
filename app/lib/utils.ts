/** Joins class names, ignoring falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Lowercase URL slug (ASCII). Non-ASCII letters are dropped, so callers must append a unique suffix. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Slug with a short random suffix, so two listings with the same title never collide. */
export function uniqueSlug(title: string, randomHex: string): string {
  const base = slugify(title);
  return base ? `${base}-${randomHex}` : `listing-${randomHex}`;
}
