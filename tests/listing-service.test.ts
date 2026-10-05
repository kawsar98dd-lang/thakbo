import { describe, expect, it } from "vitest";
import { getOwnedListingDetail } from "~/server/db/repositories/listings";
import {
  changeOwnedListingStatus,
  createListingDraft,
  deleteOwnedListing,
  updateListingDraft,
  validateDraftReferences,
} from "~/server/listing-service.server";
import { draftInput, facilityId, makeComplete, sequentialIds } from "./helpers/listings";
import { createTestDatabase, insertSecondCity, insertUser, seededAreaId, seededCityId, type TestDatabase } from "./helpers/sqlite-d1";

function setup(): TestDatabase {
  const db = createTestDatabase();
  insertUser(db, "owner");
  insertUser(db, "other");
  return db;
}

describe("creating drafts", () => {
  it("creates a draft owned by the session user with a unique slug", async () => {
    const db = setup();
    const ids = sequentialIds();
    const result = await createListingDraft(
      db.d1,
      "owner",
      draftInput({ cityId: seededCityId(db), areaId: seededAreaId(db, "hetem-khan"), facilityIds: [facilityId(db, "wifi")], audiences: ["student"] }),
      ids,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const detail = await getOwnedListingDetail(db.d1, result.listingId, "owner");
      expect(detail).toMatchObject({ status: "draft", title: "Student mess near campus", audiences: ["student"] });
      expect(db.raw.prepare("SELECT slug FROM listings WHERE id = ?").get(result.listingId)).toMatchObject({ slug: "student-mess-near-campus-s1" });
    }
  });

  it("ignores any owner or status smuggled into the input", async () => {
    const db = setup();
    const smuggled = { ...draftInput(), ownerId: "other", owner_id: "other", status: "published" } as unknown as Parameters<typeof createListingDraft>[2];
    const result = await createListingDraft(db.d1, "owner", smuggled, sequentialIds());
    expect(result.ok).toBe(true);
    expect(db.raw.prepare("SELECT owner_id, status FROM listings").get()).toMatchObject({ owner_id: "owner", status: "draft" });
  });

  it("works for a minimal draft without a location", async () => {
    const db = setup();
    expect((await createListingDraft(db.d1, "owner", draftInput({ title: undefined, rentAmount: undefined }), sequentialIds())).ok).toBe(true);
  });
});

describe("location relationship rules", () => {
  it("accepts a neighborhood of the selected city", async () => {
    const db = setup();
    const errors = await validateDraftReferences(db.d1, draftInput({ cityId: seededCityId(db), areaId: seededAreaId(db, "ghoshpara") }));
    expect(errors).toEqual({});
  });

  it("rejects a neighborhood that belongs to another city and writes nothing", async () => {
    const db = setup();
    const other = insertSecondCity(db);
    const result = await createListingDraft(db.d1, "owner", draftInput({ cityId: seededCityId(db), areaId: other.areaId }), sequentialIds());
    expect(result).toMatchObject({ ok: false, kind: "invalid" });
    if (!result.ok && result.kind === "invalid") expect(result.errors.areaId).toContain("belongs to the selected city");
    expect(db.raw.prepare("SELECT count(*) AS n FROM listings").get()).toMatchObject({ n: 0 });
  });

  it("rejects unknown and inactive cities and areas", async () => {
    const db = setup();
    expect((await validateDraftReferences(db.d1, draftInput({ cityId: 987654 }))).cityId).toBeTruthy();
    expect((await validateDraftReferences(db.d1, draftInput({ cityId: seededCityId(db), areaId: 987654 }))).areaId).toBeTruthy();
    db.raw.exec("UPDATE areas SET is_active = 0 WHERE slug = 'kazla'");
    expect((await validateDraftReferences(db.d1, draftInput({ cityId: seededCityId(db), areaId: seededAreaId(db, "kazla") }))).areaId).toBeTruthy();
  });

  it("rejects an area given without a city", async () => {
    const db = setup();
    expect((await validateDraftReferences(db.d1, draftInput({ areaId: seededAreaId(db, "kazla") }))).areaId).toBeTruthy();
  });

  it("validates sub-areas against their parent neighborhood", async () => {
    const db = setup();
    const hetem = seededAreaId(db, "hetem-khan");
    db.raw
      .prepare("INSERT INTO areas (city_id, name, slug, parent_area_id) VALUES (?, 'Hetem Khan Lane', 'hetem-khan-lane', ?)")
      .run(seededCityId(db), hetem);
    const sub = (db.raw.prepare("SELECT id FROM areas WHERE slug = 'hetem-khan-lane'").get() as { id: number }).id;
    const base = { cityId: seededCityId(db) };
    expect(await validateDraftReferences(db.d1, draftInput({ ...base, areaId: hetem, subAreaId: sub }))).toEqual({});
    expect((await validateDraftReferences(db.d1, draftInput({ ...base, areaId: seededAreaId(db, "ghoshpara"), subAreaId: sub }))).subAreaId).toBeTruthy();
  });
});

describe("facility rules", () => {
  it("rejects unknown or inactive facilities", async () => {
    const db = setup();
    expect((await validateDraftReferences(db.d1, draftInput({ facilityIds: [facilityId(db, "wifi"), 987654] }))).facilityIds).toBeTruthy();
    db.raw.exec("UPDATE facilities SET is_active = 0 WHERE slug = 'fan'");
    expect((await validateDraftReferences(db.d1, draftInput({ facilityIds: [facilityId(db, "fan")] }))).facilityIds).toBeTruthy();
  });
});

describe("updating drafts: authorization", () => {
  async function ownedDraft(db: TestDatabase) {
    const created = await createListingDraft(db.d1, "owner", draftInput({ title: "Original title" }), sequentialIds());
    if (!created.ok) throw new Error("setup failed");
    return created.listingId;
  }

  it("lets the owner update their draft", async () => {
    const db = setup();
    const id = await ownedDraft(db);
    expect((await updateListingDraft(db.d1, "owner", id, draftInput({ title: "Updated title" }))).ok).toBe(true);
    expect((await getOwnedListingDetail(db.d1, id, "owner"))?.title).toBe("Updated title");
  });

  it("answers 'not found' (not 'forbidden') to another user and changes nothing", async () => {
    const db = setup();
    const id = await ownedDraft(db);
    expect(await updateListingDraft(db.d1, "other", id, draftInput({ title: "Hijacked title" }))).toMatchObject({ ok: false, kind: "not_found" });
    expect((await getOwnedListingDetail(db.d1, id, "owner"))?.title).toBe("Original title");
  });

  it("answers 'not found' for unknown ids", async () => {
    const db = setup();
    expect(await updateListingDraft(db.d1, "owner", "dddddddd-dddd-4ddd-8ddd-dddddddddddd", draftInput())).toMatchObject({ ok: false, kind: "not_found" });
  });

  it("refuses to edit a published listing and reports validation errors without writing", async () => {
    const db = setup();
    const id = await ownedDraft(db);
    const invalid = await updateListingDraft(db.d1, "owner", id, draftInput({ cityId: 987654 }));
    expect(invalid).toMatchObject({ ok: false, kind: "invalid" });
    expect((await getOwnedListingDetail(db.d1, id, "owner"))?.cityId).toBeNull();
    makeComplete(db, id);
    db.raw.prepare("UPDATE listings SET status = 'paused' WHERE id = ?").run(id);
    expect(await updateListingDraft(db.d1, "owner", id, draftInput({ title: "Edited later on" }))).toMatchObject({ ok: false, kind: "not_editable" });
  });
});

describe("deleting and status transitions", () => {
  it("lets only the owner soft-delete a draft", async () => {
    const db = setup();
    const created = await createListingDraft(db.d1, "owner", draftInput(), sequentialIds());
    if (!created.ok) throw new Error("setup failed");
    expect(await deleteOwnedListing(db.d1, "other", created.listingId)).toMatchObject({ ok: false, kind: "not_found" });
    expect(await deleteOwnedListing(db.d1, "owner", created.listingId)).toMatchObject({ ok: true });
    expect(await getOwnedListingDetail(db.d1, created.listingId, "owner")).toBeNull();
    expect(db.raw.prepare("SELECT status FROM listings WHERE id = ?").get(created.listingId)).toMatchObject({ status: "deleted" });
    expect(await deleteOwnedListing(db.d1, "owner", created.listingId)).toMatchObject({ ok: false, kind: "not_found" });
  });

  it("only allows the documented transitions", async () => {
    const db = setup();
    const created = await createListingDraft(db.d1, "owner", draftInput(), sequentialIds());
    if (!created.ok) throw new Error("setup failed");
    // A draft cannot jump to published/pending on its own: submitting is a Milestone 3 workflow.
    expect(await changeOwnedListingStatus(db.d1, "owner", created.listingId, "published")).toMatchObject({ ok: false, kind: "not_allowed" });
    expect(await changeOwnedListingStatus(db.d1, "owner", created.listingId, "pending")).toMatchObject({ ok: false, kind: "not_allowed" });
    makeComplete(db, created.listingId);
    db.raw.prepare("UPDATE listings SET status = 'published' WHERE id = ?").run(created.listingId);
    expect(await changeOwnedListingStatus(db.d1, "owner", created.listingId, "paused")).toMatchObject({ ok: true });
    expect(await changeOwnedListingStatus(db.d1, "owner", created.listingId, "published")).toMatchObject({ ok: true });
  });
});
