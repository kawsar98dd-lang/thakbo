import { validateRejectionReason } from "~/lib/moderation";
import { getAdminRole } from "./db/repositories/admin";
import { approvePendingListing, getListingOwnerStatus, rejectPendingListing } from "./db/repositories/moderation";

/**
 * Approving or rejecting a listing. These are the ONLY functions that move a listing out of `pending`.
 * Rules, checked here AND again by the database (migration 0008 triggers):
 *  - the actor must be a registered admin or moderator (re-verified in the database, not trusted from the caller),
 *  - nobody may decide on their own listing, administrators included,
 *  - only a listing that is STILL pending can be decided (compare-and-set: of two simultaneous decisions, one wins),
 *  - a rejection needs a validated reason.
 */
export type ModerationFailure =
  | { ok: false; kind: "forbidden" }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "own_listing" }
  | { ok: false; kind: "conflict" }
  | { ok: false; kind: "invalid"; errors: { reason: string } };

export type ModerationResult = { ok: true; listingId: string } | ModerationFailure;

async function checkActor(db: D1Database, actorId: string, listingId: string): Promise<ModerationFailure | null> {
  if (!actorId || (await getAdminRole(db, actorId)) === null) return { ok: false, kind: "forbidden" };
  const listing = await getListingOwnerStatus(db, listingId);
  if (!listing || listing.status === "draft" || listing.status === "deleted") return { ok: false, kind: "not_found" };
  if (listing.ownerId === actorId) return { ok: false, kind: "own_listing" };
  if (listing.status !== "pending") return { ok: false, kind: "conflict" };
  return null;
}

export async function approveListing(db: D1Database, actorId: string, listingId: string): Promise<ModerationResult> {
  const failure = await checkActor(db, actorId, listingId);
  if (failure) return failure;
  return (await approvePendingListing(db, listingId, actorId)) ? { ok: true, listingId } : { ok: false, kind: "conflict" };
}

export async function rejectListing(db: D1Database, actorId: string, listingId: string, rawReason: unknown): Promise<ModerationResult> {
  const failure = await checkActor(db, actorId, listingId);
  if (failure) return failure;
  const reason = validateRejectionReason(rawReason);
  if (!reason.ok) return { ok: false, kind: "invalid", errors: { reason: reason.error } };
  return (await rejectPendingListing(db, listingId, actorId, reason.reason)) ? { ok: true, listingId } : { ok: false, kind: "conflict" };
}

export function moderationMessage(failure: ModerationFailure): string {
  switch (failure.kind) {
    case "forbidden":
      return "You are not allowed to review listings.";
    case "own_listing":
      return "You cannot approve or reject your own listing. Another moderator must review it.";
    case "conflict":
      return "This listing is no longer waiting for review (someone else may have decided already). Refresh the page.";
    case "invalid":
      return failure.errors.reason;
    default:
      return "This listing could not be found.";
  }
}
