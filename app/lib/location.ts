/**
 * Pure helpers for THAKBO's neighborhood-first location model. No imports: usable on server, browser and in scripts.
 *
 * Alias resolution is the PRIMARY matching mechanism (a table of known spellings, see db migration 0006).
 * `normalizeLocationText` only removes differences that never change the meaning of a name
 * (case, spacing, punctuation, accents, invisible characters, doubled Latin letters). It deliberately does NOT
 * guess vowels or transliterate between scripts, so unrelated places can never be merged.
 */

export type LanguageCode = "en" | "bn";

const INVISIBLE_CHARACTERS = /[\u200b-\u200d\u2060\ufeff]/g;
const LATIN_COMBINING_MARKS = /[\u0300-\u036f]/g;
const NOT_LETTER_MARK_OR_DIGIT = /[^\p{L}\p{M}\p{N}]+/gu;
const DOUBLED_LATIN_LETTER = /([a-z])\1+/g;

/** Maximum accepted length of user-typed location text (autocomplete queries, alias input). */
export const LOCATION_TEXT_MAX_LENGTH = 80;

/**
 * Canonical comparison key of a place name.
 *   "Hetem  Khan" → "hetemkhan"      "Shaheb-Bazar" → "shahebbazar"
 *   "হেতেম খান"   → "হেতেমখান"       "সাহেব বাজার" and "সাহেববাজার" → same key
 * Returns "" when nothing comparable is left.
 */
export function normalizeLocationText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(LATIN_COMBINING_MARKS, "")
    .normalize("NFC")
    .replace(INVISIBLE_CHARACTERS, "")
    .toLowerCase()
    .replace(NOT_LETTER_MARK_OR_DIGIT, "")
    .replace(DOUBLED_LATIN_LETTER, "$1");
}

/** True when the text contains at least one Bangla letter. */
export function containsBangla(text: string): boolean {
  return /[\u0980-\u09ff]/.test(text);
}

/** Language tag stored with an alias. */
export function detectAliasLanguage(text: string): "en" | "bn" | "mixed" {
  const bangla = containsBangla(text);
  const latin = /[a-z]/i.test(text);
  if (bangla && latin) return "mixed";
  return bangla ? "bn" : "en";
}

/** Bangla name when the UI language is Bangla and one exists; English otherwise. */
export function localizedName(
  names: { nameEn: string | null; nameBn: string | null; name: string },
  language: LanguageCode = "en",
): string {
  if (language === "bn" && names.nameBn) return names.nameBn;
  return names.nameEn ?? names.name;
}

/** "Hetem Khan, Rajshahi"  or  "হেতেম খান, রাজশাহী". Never contains database ids or private address details. */
export function formatLocationLabel(
  area: { nameEn: string | null; nameBn: string | null; name: string },
  city: { nameEn: string | null; nameBn: string | null; name: string },
  language: LanguageCode = "en",
): string {
  return `${localizedName(area, language)}, ${localizedName(city, language)}`;
}

/** Upper bound for an indexed prefix range query on normalized keys (`key >= prefix AND key < upperBound`). */
export function prefixUpperBound(prefix: string): string {
  return `${prefix}\uffff`;
}

/** Escapes `%`, `_` and `\` so user text can be used inside LIKE ... ESCAPE '\'. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}
