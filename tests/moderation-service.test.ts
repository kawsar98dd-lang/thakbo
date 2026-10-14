import { describe, expect, it } from "vitest";
import { listListingsForModeration, getListingForReview, listModerationEvents } from "~/server/db/repositories/moderation";
import { approveListing, rejectListing } from "~/server/moderation-service.server";
import { ADMIN_ID, MODERATOR_ID, insertAdmin, makeSubmittable, setProfilePhone, walkToStatus } from "./helpers/listings";
import { createTestDatabase, insertUser, type TestDatabase } from "./helpers/sqlite-d1";

const L = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const L2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function setup(): TestDatabase {
  const db = createTestDatabase();
  insertUser(db, "owner");
  insertUser(db, "other");
  insertAdmin(db, ADMIN_ID, "admin");
  insertAdmin(db, MODERATOR_ID, "moderator");
  for (const [id, slug] of [[L, "a"], [L2, "b"]] as const) {
    db.raw.prepare("INSERT INTO listings (id, owner_id, slug, property_type) VALUES (?, 'owner', ?, 'mess')").run(id, slug);
    makeSubmittable(db, id);
  }
  walkToStatus(db, L, "pending");
  return db;
}

const status = (db: TestDatabase, id = L) => (db.raw.prepare("SELECT status FROM listings WHERE id = ?").get(id) as { status: string }).status;

describe("who may decide", () => {
  it("lets an admin and a moderator approve", async () => {
    const db = setup();
    expect(await approveListing(db.d1, ADMIN_ID, L)).toMatchObject({ ok: true });
    walkToStatus(db, L2, "pending");
    expect(await approveListing(db.d1, MODERATOR_ID, L2)).toMatchObject({ ok: true });
    expect(status(db)).toBe("published");
    expect(db.raw.prepare("SELECT reviewed_by AS by, published_at AS at FROM listings WHERE id = ?").get(L)).toMatchObject({ by: ADMIN_ID });
  });

  it("refuses ordinary users, the owner and anonymous callers, and changes nothing", async () => {
    const db = setup();
    expect(await approveListing(db.d1, "other", L)).toMatchObject({ ok: false, kind: "forbidden" });
    expect(await approveListing(db.d1, "owner", L)).toMatchObject({ ok: false, kind: "forbidden" });
    expect(await approveListing(db.d1, "", L)).toMatchObject({ ok: false, kind: "forbidden" });
    expect(await rejectListing(db.d1, "other", L, "A perfectly valid reason.")).toMatchObject({ ok: false, kind: "forbidden" });
    expect(status(db)).toBe("pending");
  });

  it("honors an admin or moderator role revocation on the next moderation attempt", async () => {
    const db = setup();
    db.raw.prepare("DELETE FROM admin_users WHERE user_id = ?").run(ADMIN_ID);

    expect(await approveListing(db.d1, ADMIN_ID, L)).toMatchObject({ ok: false, kind: "forbidden" });
    expect(status(db)).toBe("pending");
    expect(db.raw.prepare("SELECT count(*) AS n FROM listing_moderation_events WHERE action IN ('approve','reject')").get()).toMatchObject({ n: 0 });

    db.raw.prepare("DELETE FROM admin_users WHERE user_id = ?").run(MODERATOR_ID);
    expect(await rejectListing(db.d1, MODERATOR_ID, L, "A valid rejection reason.")).toMatchObject({ ok: false, kind: "forbidden" });
    expect(status(db)).toBe("pending");
  });

  it("refuses self-approval and self-rejection even for an administrator", async () => {
    const db = setup();
    insertAdmin(db, "owner", "admin");
    expect(await approveListing(db.d1, "owner", L)).toMatchObject({ ok: false, kind: "own_listing" });
    expect(await rejectListing(db.d1, "owner", L, "I reject my own listing.")).toMatchObject({ ok: false, kind: "own_listing" });
    expect(status(db)).toBe("pending");
    // The repository-level compare-and-set refuses it as well, independent of the service.
    expect(db.raw.prepare("SELECT count(*) AS n FROM listing_moderation_events WHERE action IN ('approve','reject')").get()).toMatchObject({ n: 0 });
  });

  it("refuses drafts, deleted and unknown listings as not found", async () => {
    const db = setup();
    expect(await approveListing(db.d1, ADMIN_ID, L2)).toMatchObject({ ok: false, kind: "not_found" });
    expect(await approveListing(db.d1, ADMIN_ID, "dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toMatchObject({ ok: false, kind: "not_found" });
  });
});

describe("rejecting", () => {
  it("needs a valid reason and stores it with the history", async () => {
    const db = setup();
    for (const bad of [undefined, "", "short", "   ", "x".repeat(501)]) {
      expect(await rejectListing(db.d1, ADMIN_ID, L, bad)).toMatchObject({ ok: false, kind: "invalid" });
    }
    expect(status(db)).toBe("pending");
    expect(await rejectListing(db.d1, ADMIN_ID, L, "  The photos do not show the room.  ")).toMatchObject({ ok: true });
    expect(db.raw.prepare("SELECT status, rejection_reason AS r FROM listings WHERE id = ?").get(L)).toEqual({ status: "rejected", r: "The photos do not show the room." });
    const history = await listModerationEvents(db.d1, L);
    expect(history[0]).toMatchObject({ action: "reject", actorId: ADMIN_ID, actorRole: "admin", reason: "The photos do not show the room." });
  });

  it("returns moderation history newest-first and respects its limit", async () => {
    const db = setup();
    expect(await rejectListing(db.d1, ADMIN_ID, L, "The photos do not show the room.")).toMatchObject({ ok: true });
    // Owner resubmits, creating a later event in the same listing history.
    db.raw.prepare("UPDATE listings SET status = 'pending' WHERE id = ?").run(L);
    const history = await listModerationEvents(db.d1, L);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0]).toMatchObject({ action: "submit", fromStatus: "rejected", toStatus: "pending" });
    expect(history[1]).toMatchObject({ action: "reject", fromStatus: "pending", toStatus: "rejected" });
    expect(await listModerationEvents(db.d1, L, 1)).toEqual([history[0]]);
    // Negative SQLite LIMIT values mean “unlimited”; repositories must reject that footgun.
    expect(await listModerationEvents(db.d1, L, -1)).toEqual([]);
    expect(await listModerationEvents(db.d1, L, Number.NaN)).toHaveLength(2);
  });
});

describe("concurrent and stale decisions", () => {
  it("lets exactly one of two simultaneous decisions win", async () => {
    const db = setup();
    const results = await Promise.all([approveListing(db.d1, ADMIN_ID, L), rejectListing(db.d1, MODERATOR_ID, L, "Rejected by the second moderator.")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    expect(db.raw.prepare("SELECT count(*) AS n FROM listing_moderation_events WHERE action IN ('approve','reject')").get()).toMatchObject({ n: 1 });
  });

  it("answers 'conflict' when the listing is no longer pending", async () => {
    const db = setup();
    expect(await approveListing(db.d1, ADMIN_ID, L)).toMatchObject({ ok: true });
    expect(await approveListing(db.d1, MODERATOR_ID, L)).toMatchObject({ ok: false, kind: "conflict" });
    expect(await rejectListing(db.d1, MODERATOR_ID, L, "Too late for this decision.")).toMatchObject({ ok: false, kind: "conflict" });
    expect(status(db)).toBe("published");
  });
});

describe("moderator views", () => {
  it("queues only pending listings, oldest first, and never drafts", async () => {
    const db = setup();
    walkToStatus(db, L2, "pending");
    db.raw.prepare("UPDATE listings SET submitted_at = '2026-01-02T00:00:00Z' WHERE id = ?").run(L);
    db.raw.prepare("UPDATE listings SET submitted_at = '2026-01-01T00:00:00Z' WHERE id = ?").run(L2);
    expect((await listListingsForModeration(db.d1, "pending")).map((i) => i.id)).toEqual([L2, L]);
    expect(await listListingsForModeration(db.d1, "draft")).toEqual([]);
    expect(await listListingsForModeration(db.d1, "deleted")).toEqual([]);
  });

  it("rejects unsupported queue statuses and applies the requested result limit", async () => {
    const db = setup();
    walkToStatus(db, L2, "pending");
    expect(await listListingsForModeration(db.d1, "draft")).toEqual([]);
    expect(await listListingsForModeration(db.d1, "deleted")).toEqual([]);
    expect(await listListingsForModeration(db.d1, "pending", 1)).toHaveLength(1);
    expect(await listListingsForModeration(db.d1, "pending", 0)).toEqual([]);
    expect(await listListingsForModeration(db.d1, "pending", -1)).toEqual([]);
    expect(await listListingsForModeration(db.d1, "pending", Number.POSITIVE_INFINITY)).toHaveLength(2);
  });

  it("uses listing ID as a stable tie-breaker for submissions with the same timestamp", async () => {
    const db = setup();
    walkToStatus(db, L2, "pending");
    db.raw.prepare("UPDATE listings SET submitted_at = '2026-01-01T00:00:00Z' WHERE id IN (?, ?)").run(L, L2);
    expect((await listListingsForModeration(db.d1, "pending")).map((item) => item.id)).toEqual([L, L2]);
  });

  it("shows private review data to the moderator layer only (owner contact, address, coordinates)", async () => {
    const db = setup();
    setProfilePhone(db, "owner", "01712345678", "01812345678");
    const review = await getListingForReview(db.d1, L);
    expect(review).toMatchObject({ ownerPhone: "01712345678", ownerWhatsapp: "01812345678", latitude: 24.37, longitude: 88.6 });
    expect(review?.imageIds).toHaveLength(1);
    db.raw.prepare("INSERT INTO listings (id, owner_id, slug, property_type) VALUES ('d', 'owner', 'draft-one', 'mess')").run();
    expect(await getListingForReview(db.d1, "d")).toBeNull();
  });
});
