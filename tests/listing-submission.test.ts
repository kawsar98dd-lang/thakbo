import { describe, expect, it } from "vitest";
import { getOwnedListingDetail } from "~/server/db/repositories/listings";
import { createListingDraft, moveListingToDraft, submitListing, updateListing } from "~/server/listing-service.server";
import { addImage, draftInput, insertAdmin, makeSubmittable, sequentialIds, setProfilePhone, walkToStatus } from "./helpers/listings";
import { createTestDatabase, insertSecondCity, insertUser, seededAreaId, seededCityId, type TestDatabase } from "./helpers/sqlite-d1";

function setup(): TestDatabase {
  const db = createTestDatabase();
  insertUser(db, "owner");
  insertUser(db, "other");
  return db;
}

async function newDraft(db: TestDatabase, overrides = {}): Promise<string> {
  const result = await createListingDraft(
    db.d1,
    "owner",
    draftInput({ cityId: seededCityId(db), areaId: seededAreaId(db, "hetem-khan"), description: "A clean and quiet place near the university.", latitude: 24.37, longitude: 88.6, ...overrides }),
    sequentialIds(),
  );
  if (!result.ok) throw new Error("setup failed");
  return result.listingId;
}

const status = (db: TestDatabase, id: string) => (db.raw.prepare("SELECT status FROM listings WHERE id = ?").get(id) as { status: string }).status;

describe("saving drafts", () => {
  it("saves an incomplete draft (no photo, no location, no contact needed)", async () => {
    const db = setup();
    const created = await createListingDraft(db.d1, "owner", draftInput(), sequentialIds());
    expect(created.ok).toBe(true);
  });

  it("rejects a location that is far from the selected city, and never replaces it with the city centre", async () => {
    const db = setup();
    const result = await createListingDraft(db.d1, "owner", draftInput({ cityId: seededCityId(db), latitude: 23.81, longitude: 90.41 }), sequentialIds());
    expect(result).toMatchObject({ ok: false, kind: "invalid" });
    expect(db.raw.prepare("SELECT count(*) AS n FROM listings").get()).toMatchObject({ n: 0 });
  });

  it("keeps the stored coordinates when an edit sends none", async () => {
    const db = setup();
    const id = await newDraft(db);
    await updateListing(db.d1, "owner", id, draftInput({ title: "A different title", cityId: seededCityId(db), areaId: seededAreaId(db, "hetem-khan") }));
    expect(await getOwnedListingDetail(db.d1, id, "owner")).toMatchObject({ latitude: 24.37, longitude: 88.6 });
  });
});

describe("submitting for review", () => {
  it("moves a complete draft to pending and records the submission", async () => {
    const db = setup();
    const id = await newDraft(db);
    addImage(db, id);
    setProfilePhone(db, "owner", "01712345678");
    expect(await submitListing(db.d1, "owner", id)).toMatchObject({ ok: true });
    expect(status(db, id)).toBe("pending");
    expect(db.raw.prepare("SELECT action FROM listing_moderation_events WHERE listing_id = ?").all(id)).toEqual([{ action: "submit" }]);
    expect((db.raw.prepare("SELECT submitted_at FROM listings WHERE id = ?").get(id) as { submitted_at: string | null }).submitted_at).not.toBeNull();
  });

  it("reports every missing requirement at once and changes nothing", async () => {
    const db = setup();
    const id = (await createListingDraft(db.d1, "owner", draftInput(), sequentialIds())) as { ok: true; listingId: string };
    const result = await submitListing(db.d1, "owner", id.listingId);
    expect(result.ok).toBe(false);
    if (result.ok || result.kind !== "invalid") throw new Error("expected validation errors");
    expect(Object.keys(result.errors).sort()).toEqual(["areaId", "cityId", "contact", "description", "images", "location"]);
    expect(status(db, id.listingId)).toBe("draft");
  });

  it("requires a photo", async () => {
    const db = setup();
    const id = await newDraft(db);
    setProfilePhone(db, "owner", "01712345678");
    const result = await submitListing(db.d1, "owner", id);
    expect(result).toMatchObject({ ok: false, kind: "invalid", errors: { images: expect.any(String) } });
  });

  it("requires a valid contact method on the owner's profile", async () => {
    const db = setup();
    const id = await newDraft(db);
    addImage(db, id);
    expect(await submitListing(db.d1, "owner", id)).toMatchObject({ ok: false, kind: "invalid", errors: { contact: expect.any(String) } });
    setProfilePhone(db, "owner", "12345", null);
    expect(await submitListing(db.d1, "owner", id)).toMatchObject({ ok: false, kind: "invalid", errors: { contact: expect.any(String) } });
    setProfilePhone(db, "owner", null, "+8801712345678");
    expect(await submitListing(db.d1, "owner", id)).toMatchObject({ ok: true });
  });

  it("refuses a missing or invalid location and a city mismatch", async () => {
    const db = setup();
    const id = await newDraft(db, { latitude: undefined, longitude: undefined });
    addImage(db, id);
    setProfilePhone(db, "owner", "01712345678");
    expect(await submitListing(db.d1, "owner", id)).toMatchObject({ ok: false, kind: "invalid", errors: { location: expect.any(String) } });
    db.raw.prepare("UPDATE listings SET latitude = 40.7, longitude = -74 WHERE id = ?").run(id);
    expect(await submitListing(db.d1, "owner", id)).toMatchObject({ ok: false, kind: "invalid", errors: { location: expect.any(String) } });
    const other = insertSecondCity(db);
    db.raw.prepare("UPDATE listings SET latitude = 24.37, longitude = 88.6, city_id = ?, area_id = ? WHERE id = ?").run(other.cityId, other.areaId, id);
    // Testville has no known centre: the point cannot be compared and is accepted as long as it is inside Bangladesh.
    expect(await submitListing(db.d1, "owner", id)).toMatchObject({ ok: true });
  });

  it("treats other people's and unknown listings as not found, and cannot submit twice", async () => {
    const db = setup();
    const id = await newDraft(db);
    addImage(db, id);
    setProfilePhone(db, "owner", "01712345678");
    expect(await submitListing(db.d1, "other", id)).toMatchObject({ ok: false, kind: "not_found" });
    expect(await submitListing(db.d1, "owner", "dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toMatchObject({ ok: false, kind: "not_found" });
    expect(await submitListing(db.d1, "owner", id)).toMatchObject({ ok: true });
    expect(await submitListing(db.d1, "owner", id)).toMatchObject({ ok: false, kind: "not_allowed" });
  });
});

describe("editing after review", () => {
  it("locks a pending listing until it is withdrawn", async () => {
    const db = setup();
    const id = await newDraft(db);
    makeSubmittable(db, id);
    walkToStatus(db, id, "pending");
    expect(await updateListing(db.d1, "owner", id, draftInput({ title: "Sneaky edit" }))).toMatchObject({ ok: false, kind: "not_editable" });
    expect(await moveListingToDraft(db.d1, "owner", id)).toMatchObject({ ok: true });
    expect(status(db, id)).toBe("draft");
  });

  it("lets a rejected listing be corrected in place and resubmitted", async () => {
    const db = setup();
    const id = await newDraft(db);
    makeSubmittable(db, id);
    walkToStatus(db, id, "rejected");
    const edited = await updateListing(db.d1, "owner", id, draftInput({ title: "Better title", description: "Now described in much more detail.", cityId: seededCityId(db), areaId: seededAreaId(db, "hetem-khan") }));
    expect(edited).toMatchObject({ ok: true, wentOffline: false });
    expect(status(db, id)).toBe("rejected");
    expect(await submitListing(db.d1, "owner", id)).toMatchObject({ ok: true });
    expect(status(db, id)).toBe("pending");
  });

  it("takes a published listing offline at once when it is edited, and needs moderation again", async () => {
    const db = setup();
    const id = await newDraft(db);
    makeSubmittable(db, id);
    walkToStatus(db, id, "published");
    const edited = await updateListing(db.d1, "owner", id, draftInput({ title: "Edited live listing", description: "Now with a longer description of the place.", cityId: seededCityId(db), areaId: seededAreaId(db, "hetem-khan") }));
    expect(edited).toMatchObject({ ok: true, wentOffline: true });
    expect(status(db, id)).toBe("pending");
    expect(db.raw.prepare("SELECT action FROM listing_moderation_events WHERE listing_id = ? ORDER BY rowid DESC LIMIT 1").get(id)).toEqual({ action: "unpublish" });
    expect(db.raw.prepare("SELECT count(*) AS n FROM listings WHERE id = ? AND status = 'published'").get(id)).toMatchObject({ n: 0 });
  });

  it("does not let a live listing be saved in a way that would not pass submission", async () => {
    const db = setup();
    const id = await newDraft(db);
    makeSubmittable(db, id);
    walkToStatus(db, id, "published");
    const result = await updateListing(db.d1, "owner", id, draftInput({ title: "x", description: undefined, cityId: seededCityId(db), areaId: seededAreaId(db, "hetem-khan") }));
    expect(result).toMatchObject({ ok: false, kind: "invalid" });
    expect(status(db, id)).toBe("published");
    expect((await getOwnedListingDetail(db.d1, id, "owner"))?.title).toBe("Complete listing");
  });

  it("lets only the owner move a published listing back to draft", async () => {
    const db = setup();
    const id = await newDraft(db);
    makeSubmittable(db, id);
    walkToStatus(db, id, "published");
    insertAdmin(db, "root", "admin");
    expect(await moveListingToDraft(db.d1, "other", id)).toMatchObject({ ok: false, kind: "not_found" });
    expect(await moveListingToDraft(db.d1, "owner", id)).toMatchObject({ ok: true });
  });
});
