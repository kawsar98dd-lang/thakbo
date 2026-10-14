import { describe, expect, it } from "vitest";
import { addImage, ADMIN_ID, insertAdmin, makeComplete, walkToStatus } from "./helpers/listings";
import { applyMigration, createTestDatabase, insertUser, type TestDatabase } from "./helpers/sqlite-d1";

const L = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function setup(): TestDatabase {
  const db = createTestDatabase();
  insertUser(db, "owner");
  insertUser(db, "other");
  db.raw.prepare("INSERT INTO listings (id, owner_id, slug, property_type) VALUES (?, 'owner', 'a', 'mess')").run(L);
  makeComplete(db, L);
  return db;
}

/** Message of the error a statement raises ("" when it succeeds). */
function attempt(db: TestDatabase, sql: string, ...params: Array<string | number | null>): string {
  try {
    db.raw.prepare(sql).run(...params);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const events = (db: TestDatabase) =>
  db.raw.prepare("SELECT action, from_status AS fromStatus, to_status AS toStatus, actor_id AS actorId, actor_role AS actorRole, reason FROM listing_moderation_events WHERE listing_id = ? ORDER BY rowid").all(L) as Array<Record<string, string | null>>;

describe("migration 0008", () => {
  it("is additive: existing rows survive and get empty review columns", () => {
    const db = createTestDatabase({ stopBefore: "0008" });
    insertUser(db, "owner");
    db.raw.prepare("INSERT INTO listings (id, owner_id, slug, property_type, title) VALUES (?, 'owner', 'old', 'mess', 'Old draft')").run(L);
    applyMigration(db, "0008");
    expect(db.raw.prepare("SELECT title, status, submitted_at, reviewed_by, rejection_reason FROM listings WHERE id = ?").get(L)).toMatchObject({
      title: "Old draft", status: "draft", submitted_at: null, reviewed_by: null, rejection_reason: null,
    });
    expect(db.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("keeps foreign keys intact", () => {
    const db = setup();
    expect(attempt(db, "INSERT INTO listing_moderation_events (id, listing_id, actor_role, action, from_status, to_status) VALUES ('e', 'nope', 'owner', 'submit', 'draft', 'pending')")).toContain("FOREIGN KEY");
    expect(attempt(db, "INSERT INTO listing_moderation_events (id, listing_id, actor_id, actor_role, action, from_status, to_status) VALUES ('e', ?, 'ghost', 'owner', 'submit', 'draft', 'pending')", L)).toContain("FOREIGN KEY");
    expect(attempt(db, "UPDATE listings SET reviewed_by = 'ghost' WHERE id = ?", L)).toContain("FOREIGN KEY");
    expect(db.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
});

describe("status transitions enforced by the database", () => {
  it("refuses transitions outside the documented graph", () => {
    const db = setup();
    addImage(db, L);
    expect(attempt(db, "UPDATE listings SET status = 'published' WHERE id = ?", L)).toContain("invalid listing status transition");
    expect(attempt(db, "UPDATE listings SET status = 'rejected' WHERE id = ?", L)).toContain("invalid listing status transition");
    walkToStatus(db, L, "pending");
    walkToStatus(db, L, "published");
    expect(attempt(db, "UPDATE listings SET status = 'rejected' WHERE id = ?", L)).toContain("invalid listing status transition");
    walkToStatus(db, L, "paused");
    // paused -> published is not allowed for anyone: a paused listing goes through moderation again.
    expect(attempt(db, "UPDATE listings SET status = 'published', reviewed_by = ? WHERE id = ?", ADMIN_ID, L)).toContain("invalid listing status transition");
    db.raw.prepare("UPDATE listings SET status = 'deleted' WHERE id = ?").run(L);
    expect(attempt(db, "UPDATE listings SET status = 'draft' WHERE id = ?", L)).toContain("invalid listing status transition");
  });

  it("needs a photo before review", () => {
    const db = setup();
    expect(attempt(db, "UPDATE listings SET status = 'pending' WHERE id = ?", L)).toContain("at least one image");
    addImage(db, L);
    expect(attempt(db, "UPDATE listings SET status = 'pending' WHERE id = ?", L)).toBe("");
  });

  it("never lets the owner, a stranger or a missing reviewer decide, administrators included", () => {
    const db = setup();
    walkToStatus(db, L, "pending");
    insertAdmin(db, "owner", "admin"); // the owner is ALSO an administrator
    expect(attempt(db, "UPDATE listings SET status = 'published', reviewed_by = 'owner' WHERE id = ?", L)).toContain("different, registered reviewer");
    expect(attempt(db, "UPDATE listings SET status = 'published' WHERE id = ?", L)).toContain("different, registered reviewer");
    expect(attempt(db, "UPDATE listings SET status = 'published', reviewed_by = 'other' WHERE id = ?", L)).toContain("different, registered reviewer");
    expect(attempt(db, "UPDATE listings SET status = 'rejected', reviewed_by = 'owner', rejection_reason = 'Not good enough at all.' WHERE id = ?", L)).toContain("different, registered reviewer");
    insertAdmin(db, "mod-1", "moderator");
    expect(attempt(db, "UPDATE listings SET status = 'published', reviewed_by = 'mod-1' WHERE id = ?", L)).toBe("");
  });

  it("refuses a decision when the reviewer role has been revoked", () => {
    const db = setup();
    walkToStatus(db, L, "pending");
    insertAdmin(db, "revoked-reviewer", "moderator");
    db.raw.prepare("DELETE FROM admin_users WHERE user_id = ?").run("revoked-reviewer");

    expect(attempt(db, "UPDATE listings SET status = 'published', reviewed_by = ? WHERE id = ?", "revoked-reviewer", L)).toContain("different, registered reviewer");
    expect((db.raw.prepare("SELECT status FROM listings WHERE id = ?").get(L) as { status: string }).status).toBe("pending");
    expect(events(db).filter((event) => event.action === "approve")).toEqual([]);
  });

  it("requires a 10-500 character reason for a rejection", () => {
    const db = setup();
    walkToStatus(db, L, "pending");
    insertAdmin(db);
    expect(attempt(db, "UPDATE listings SET status = 'rejected', reviewed_by = ? WHERE id = ?", ADMIN_ID, L)).toContain("reason");
    expect(attempt(db, "UPDATE listings SET status = 'rejected', reviewed_by = ?, rejection_reason = 'too short' WHERE id = ?", ADMIN_ID, L)).toContain("reason");
    expect(attempt(db, "UPDATE listings SET status = 'rejected', reviewed_by = ?, rejection_reason = ? WHERE id = ?", ADMIN_ID, "x".repeat(501), L)).not.toBe("");
    expect(attempt(db, "UPDATE listings SET status = 'rejected', reviewed_by = ?, rejection_reason = 'The photos do not show the room.' WHERE id = ?", ADMIN_ID, L)).toBe("");
  });
});

describe("moderation history", () => {
  it("records every status change automatically, with actor, role and reason", () => {
    const db = setup();
    walkToStatus(db, L, "pending");
    walkToStatus(db, L, "rejected");
    db.raw.prepare("UPDATE listings SET status = 'pending' WHERE id = ?").run(L);
    walkToStatus(db, L, "published");
    db.raw.prepare("UPDATE listings SET status = 'pending' WHERE id = ?").run(L); // owner edits a live listing
    db.raw.prepare("UPDATE listings SET status = 'draft' WHERE id = ?").run(L);
    db.raw.prepare("UPDATE listings SET status = 'deleted' WHERE id = ?").run(L);

    expect(events(db)).toEqual([
      { action: "submit", fromStatus: "draft", toStatus: "pending", actorId: "owner", actorRole: "owner", reason: null },
      { action: "reject", fromStatus: "pending", toStatus: "rejected", actorId: ADMIN_ID, actorRole: "admin", reason: "Photos are too dark to see the room." },
      { action: "submit", fromStatus: "rejected", toStatus: "pending", actorId: "owner", actorRole: "owner", reason: null },
      { action: "approve", fromStatus: "pending", toStatus: "published", actorId: ADMIN_ID, actorRole: "admin", reason: null },
      { action: "unpublish", fromStatus: "published", toStatus: "pending", actorId: "owner", actorRole: "owner", reason: null },
      { action: "withdraw", fromStatus: "pending", toStatus: "draft", actorId: "owner", actorRole: "owner", reason: null },
      { action: "delete", fromStatus: "draft", toStatus: "deleted", actorId: "owner", actorRole: "owner", reason: null },
    ]);
  });

  it("chains consistently: each event starts where the previous one ended", () => {
    const db = setup();
    walkToStatus(db, L, "paused");
    const list = events(db);
    expect(list[0]?.fromStatus).toBe("draft");
    for (let i = 1; i < list.length; i += 1) expect(list[i]?.fromStatus).toBe(list[i - 1]?.toStatus);
    expect(list[list.length - 1]?.toStatus).toBe((db.raw.prepare("SELECT status FROM listings WHERE id = ?").get(L) as { status: string }).status);
  });

  it("writes nothing for edits that do not change the status, or for a refused change", () => {
    const db = setup();
    db.raw.prepare("UPDATE listings SET title = 'Another title' WHERE id = ?").run(L);
    attempt(db, "UPDATE listings SET status = 'published' WHERE id = ?", L);
    expect(events(db)).toEqual([]);
  });
});

describe("migration 0010 compatibility", () => {
  it("preserves pre-existing listings and moderation events when applied after migration 0009", () => {
    const db = createTestDatabase({ stopBefore: "0010", seed: true });
    insertUser(db, "owner");
    db.raw.prepare("INSERT INTO listings (id, owner_id, slug, property_type) VALUES (?, 'owner', 'before-retention', 'mess')").run(L);
    makeComplete(db, L);
    addImage(db, L);
    walkToStatus(db, L, "pending");
    const before = (db.raw.prepare("SELECT COUNT(*) AS count FROM listing_moderation_events WHERE listing_id = ?").get(L) as { count: number }).count;
    expect(before).toBeGreaterThan(0);

    applyMigration(db, "0010");

    expect((db.raw.prepare("SELECT status FROM listings WHERE id = ?").get(L) as { status: string }).status).toBe("pending");
    expect((db.raw.prepare("SELECT COUNT(*) AS count FROM listing_moderation_events WHERE listing_id = ?").get(L) as { count: number }).count).toBe(before);
    expect(db.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    const event = db.raw.prepare("SELECT id FROM listing_moderation_events WHERE listing_id = ? LIMIT 1").get(L) as { id: string };
    expect(attempt(db, "UPDATE listing_moderation_events SET reason = 'changed' WHERE id = ?", event.id)).toContain("immutable");
  });
});

describe("moderation audit retention migration 0010", () => {
  it("rejects direct updates and deletes of moderation events", () => {
    const db = setup();
    addImage(db, L);
    walkToStatus(db, L, "pending");
    const event = db.raw.prepare("SELECT id FROM listing_moderation_events WHERE listing_id = ? LIMIT 1").get(L) as { id: string };

    expect(attempt(db, "UPDATE listing_moderation_events SET reason = 'tampered' WHERE id = ?", event.id)).toContain("immutable");
    expect(attempt(db, "DELETE FROM listing_moderation_events WHERE id = ?", event.id)).toContain("cannot be deleted");
    expect(db.raw.prepare("SELECT COUNT(*) AS count FROM listing_moderation_events WHERE listing_id = ?").get(L)).toMatchObject({ count: 1 });
  });

  it("blocks physical listing deletion when audit history exists, while soft deletion retains history", () => {
    const db = setup();
    addImage(db, L);
    walkToStatus(db, L, "pending");
    const before = (db.raw.prepare("SELECT COUNT(*) AS count FROM listing_moderation_events WHERE listing_id = ?").get(L) as { count: number }).count;

    expect(attempt(db, "DELETE FROM listings WHERE id = ?", L)).toContain("use deleted status");
    expect((db.raw.prepare("SELECT status FROM listings WHERE id = ?").get(L) as { status: string }).status).toBe("pending");

    db.raw.prepare("UPDATE listings SET status = 'draft' WHERE id = ?").run(L);
    db.raw.prepare("UPDATE listings SET status = 'deleted' WHERE id = ?").run(L);
    expect((db.raw.prepare("SELECT COUNT(*) AS count FROM listing_moderation_events WHERE listing_id = ?").get(L) as { count: number }).count).toBe(before + 2);
  });
});
