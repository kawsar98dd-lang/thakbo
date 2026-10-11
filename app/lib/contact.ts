/**
 * Contact numbers (the owner's profile phone / WhatsApp). No SMS or verification provider is involved:
 * "valid" only means "has the shape of a real phone number", which is enough to refuse obvious junk at submission.
 */

const BD_MOBILE = /^(?:\+?880|0)1[3-9]\d{8}$/;
const INTERNATIONAL = /^\+[1-9]\d{7,14}$/;

/** Returns the number in a canonical form, or null when it is missing or malformed. */
export function normalizeContactNumber(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const compact = value.replace(/[\s-]/g, "");
  if (compact === "") return null;
  const bd = BD_MOBILE.exec(compact);
  if (bd) return `+880${compact.replace(/^(?:\+?880|0)/, "")}`;
  return INTERNATIONAL.test(compact) ? compact : null;
}

export interface ContactSource {
  phone: string | null | undefined;
  whatsapp: string | null | undefined;
}

/** True when at least one of the two numbers is usable. */
export function hasValidContact(profile: ContactSource | null | undefined): boolean {
  if (!profile) return false;
  return normalizeContactNumber(profile.phone) !== null || normalizeContactNumber(profile.whatsapp) !== null;
}
