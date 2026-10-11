import { REJECTION_REASON_LIMITS } from "./constants";

export type ReasonCheck = { ok: true; reason: string } | { ok: false; error: string };

/** A control character other than a line break or tab (these have no place in a reason shown to owners). */
function hasForbiddenControl(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x20 && code !== 0x0a && code !== 0x09) return true;
    if (code === 0x7f) return true;
  }
  return false;
}

/** Server-side check of a rejection reason: required, 10–500 characters, plain text. */
export function validateRejectionReason(raw: unknown): ReasonCheck {
  if (typeof raw !== "string") return { ok: false, error: "Write the reason for rejecting this listing." };
  const reason = raw.replace(/\r\n/g, "\n").trim();
  if (reason.length < REJECTION_REASON_LIMITS.min) {
    return { ok: false, error: `Write a clear reason (at least ${REJECTION_REASON_LIMITS.min} characters) so the owner knows what to fix.` };
  }
  if (reason.length > REJECTION_REASON_LIMITS.max) {
    return { ok: false, error: `The reason is too long (maximum ${REJECTION_REASON_LIMITS.max} characters).` };
  }
  if (hasForbiddenControl(reason)) return { ok: false, error: "The reason contains characters that are not allowed." };
  return { ok: true, reason };
}
