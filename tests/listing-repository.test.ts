import { describe, expect, it } from "vitest";
import { parseSearchParams } from "~/lib/validation/search";
import {
  createDraftListing,
  getOwnedListing,
  getOwnedListingDetail,
  getPublishedListingBySlug,
  listOwnedListings,
  searchListings,
  setOwnedListingStatus,
  updateOwnedDraft,
} from "~/server/db/repositories/listings";
import { draftData, facilityId } from "./helpers/listings";
import { createTestDatabase, insertUser, seededAreaId, seededCityId, type TestDatabase } from "./helpers/sqlite-d1";

const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function setup(): TestDatabase {
  const db = createTestDatabase();
  insertUser(db, "owner");
  insertUser(db, "other");
  return db;
}

/** Makes a listing look like a complete, public one (the real publish flow arrives in Milestone 3). */
function forcePublished(db: TestDatabase, id: string, status: string = "published") {
  db.raw
    .prepare("UPDATE listings SET status = ?, city_id = ?, area_id = ?, latitude = 24.37, longitude = 88.6, rent_amount = 3000, title = 'Public place' WHERE id = ?")
    .run(status, seededCityId(db), seededAreaId(db, "hetem-khan"), id);
}

const searchAll = (db: TestDatabase) => searchListings(db.d1, parseSearchParams(new URLSearchParams("")));

describe("draft creation", () => {
  it("creates a draft owned by the given user, with a slug and the draft status", async () => {
    const db = setup();
    await createDraftListing(db.d1, "owner", draftData(), { id: ID_A, slug: "student-mess-a1b2c3" });
    expect(db.raw.prepare("SELECT owner_id, status, slug FROM listings WHERE id = ?").get(ID_A)).toMatchObject({
      owner_id: "owner",
      status: "draft",
      slug: "student-mess-a1b2c3",
    });
  });

  it("can be incomplete: only a property type is required", async () => {
    const db = setup();
    await createDraftListing(db.d1, "owner", draftData({ title: null, rentAmount: null }), { id: ID_A, slug: "draft-x" });
    expect(await getOwnedListingDetail(db.d1, ID_A, "owner")).toMatchObject({ title: null, rentAmount: null, status: "draft" });
  });

  it("stores location, facilities and audiences together", async () => {
    const db = setup();
    const wifi = facilityId(db, "wifi");
    const fan = facilityId(db, "fan");
    await createDraftListing(
      db.d1,
      "owner",
      draftData({ cityId: seededCityId(db), areaId: seededAreaId(db, "hetem-khan"), landmark: "Near the mosque", facilityIds: [wifi, fan], audiences: ["student", "male"] }),
      { id: ID_A, slug: "d-1" },
    );
    const detail = await getOwnedListingDetail(db.d1, ID_A, "owner");
    expect(detail?.facilityIds).toEqual([wifi, fan].sort((a, b) => a - b));
    expect(detail?.audiences).toEqual(["male", "student"]);
    expect(detail?.landmark).toBe("Near the mosque");
    expect(detail?.areaId).toBe(seededAreaId(db, "hetem-khan"));
  });

  it("is atomic: an invalid facility id rolls back the whole draft", async () => {
    const db = setup();
    let failed = false;
    try {
      await createDraftListing(db.d1, "owner", draftData({ facilityIds: [999999] }), { id: ID_A, slug: "d-1" });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
    expect(db.raw.prepare("SELECT count(*) AS n FROM listings").get()).toMatchObject({ n: 0 });
  });

  it("cannot store the same facility twice for one listing", async () => {
    const db = setup();
    const wifi = facilityId(db, "wifi");
    await createDraftListing(db.d1, "owner", draftData({ facilityIds: [wifi, wifi] }), { id: ID_A, slug: "d-1" });
    expect(db.raw.prepare("SELECT count(*) AS n FROM listing_facilities").get()).toMatchObject({ n: 1 });
    let failed = false;
    try {
      db.raw.prepare("INSERT INTO listing_facilities (listing_id, facility_id) VALUES (?, ?)").run(ID_A, wifi);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});

describe("ownership: reading", () => {
  it("shows only the current user's listings, newest first, without deleted ones", async () => {
    const db = setup();
    await createDraftListing(db.d1, "owner", draftData({ title: "Mine one" }), { id: ID_A, slug: "mine-1" });
    await createDraftListing(db.d1, "other", draftData({ title: "Not mine" }), { id: ID_B, slug: "not-mine" });
    const mine = await listOwnedListings(db.d1, "owner");
    expect(mine.map((l) => l.id)).toEqual([ID_A]);
    expect((await listOwnedListings(db.d1, "other")).map((l) => l.id)).toEqual([ID_B]);
    db.raw.prepare("UPDATE listings SET status = 'deleted' WHERE id = ?").run(ID_A);
    expect(await listOwnedListings(db.d1, "owner")).toEqual([]);
  });

  it("returns names for the dashboard (Bangla included) and null for unset locations", async () => {
    const db = setup();
    await createDraftListing(db.d1, "owner", draftData({ cityId: seededCityId(db), areaId: seededAreaId(db, "hetem-khan") }), { id: ID_A, slug: "a" });
    await createDraftListing(db.d1, "owner", draftData(), { id: ID_B, slug: "b" });
    const rows = await listOwnedListings(db.d1, "owner");
    expect(rows.find((r) => r.id === ID_A)).toMatchObject({ areaName: "Hetem Khan", areaNameBn: "হেতেম খান", cityName: "Rajshahi" });
    expect(rows.find((r) => r.id === ID_B)).toMatchObject({ areaName: null, cityName: null });
  });

  it("does not return another user's listing by id", async () => {
    const db = setup();
    await createDraftListing(db.d1, "owner", draftData(), { id: ID_A, slug: "a" });
    expect(await getOwnedListing(db.d1, ID_A, "other")).toBeNull();
    expect(await getOwnedListingDetail(db.d1, ID_A, "other")).toBeNull();
    expect(await getOwnedListing(db.d1, ID_A, "owner")).toMatchObject({ id: ID_A, status: "draft" });
  });
});

describe("ownership: updating a draft", () => {
  it("lets the owner update the draft and replaces facilities and audiences", async () => {
    const db = setup();
    const wifi = facilityId(db, "wifi");
    const ac = facilityId(db, "ac");
    await createDraftListing(db.d1, "owner", draftData({ facilityIds: [wifi], audiences: ["student"] }), { id: ID_A, slug: "a" });
    const updated = await updateOwnedDraft(db.d1, ID_A, "owner", draftData({ title: "New title here", rentAmount: 4500, facilityIds: [ac], audiences: ["family"] }));
    expect(updated).toBe(true);
    expect(await getOwnedListingDetail(db.d1, ID_A, "owner")).toMatchObject({ title: "New title here", rentAmount: 4500, facilityIds: [ac], audiences: ["family"] });
  });

  it("rejects an update by another user and leaves every table untouched", async () => {
    const db = setup();
    const wifi = facilityId(db, "wifi");
    await createDraftListing(db.d1, "owner", draftData({ title: "Original title", facilityIds: [wifi], audiences: ["student"] }), { id: ID_A, slug: "a" });
    const result = await updateOwnedDraft(db.d1, ID_A, "other", draftData({ title: "Hijacked title", facilityIds: [], audiences: ["family"] }));
    expect(result).toBe(false);
    expect(await getOwnedListingDetail(db.d1, ID_A, "owner")).toMatchObject({ title: "Original title", facilityIds: [wifi], audiences: ["student"] });
  });

  it("never changes the owner, status or slug", async () => {
    const db = setup();
    await createDraftListing(db.d1, "owner", draftData(), { id: ID_A, slug: "stable-slug" });
    await updateOwnedDraft(db.d1, ID_A, "owner", draftData({ title: "Changed title" }));
    expect(db.raw.prepare("SELECT owner_id, status, slug FROM listings WHERE id = ?").get(ID_A)).toMatchObject({
      owner_id: "owner",
      status: "draft",
      slug: "stable-slug",
    });
  });

  it("refuses to edit listings that are no longer drafts", async () => {
    const db = setup();
    await createDraftListing(db.d1, "owner", draftData({ audiences: ["student"] }), { id: ID_A, slug: "a" });
    forcePublished(db, ID_A);
    expect(await updateOwnedDraft(db.d1, ID_A, "owner", draftData({ title: "Edited after publishing", audiences: ["family"] }))).toBe(false);
    expect((await getOwnedListingDetail(db.d1, ID_A, "owner"))?.audiences).toEqual(["student"]);
  });

  it("keeps stored coordinates when none are supplied", async () => {
    const db = setup();
    await createDraftListing(db.d1, "owner", draftData({ latitude: 24.37, longitude: 88.6 }), { id: ID_A, slug: "a" });
    await updateOwnedDraft(db.d1, ID_A, "owner", draftData({ title: "Another title" }));
    expect(await getOwnedListingDetail(db.d1, ID_A, "owner")).toMatchObject({ latitude: 24.37, longitude: 88.6 });
  });
});

describe("ownership: status changes", () => {
  it("is compare-and-set and owner-only", async () => {
    const db = setup();
    await createDraftListing(db.d1, "owner", draftData(), { id: ID_A, slug: "a" });
    expect(await setOwnedListingStatus(db.d1, ID_A, "other", "draft", "deleted")).toBe(false);
    expect(await setOwnedListingStatus(db.d1, ID_A, "owner", "published", "paused")).toBe(false);
    expect(await setOwnedListingStatus(db.d1, ID_A, "owner", "draft", "deleted")).toBe(true);
    expect(await getOwnedListing(db.d1, ID_A, "owner")).toBeNull();
    expect(db.raw.prepare("SELECT status FROM listings WHERE id = ?").get(ID_A)).toMatchObject({ status: "deleted" });
  });
});

describe("public visibility", () => {
  it("never shows a draft on the public listing page or in public search", async () => {
    const db = setup();
    await createDraftListing(db.d1, "owner", draftData({ cityId: seededCityId(db), areaId: seededAreaId(db, "hetem-khan") }), { id: ID_A, slug: "visible-slug" });
    expect(await getPublishedListingBySlug(db.d1, "visible-slug")).toBeNull();
    expect((await searchAll(db)).items).toEqual([]);
  });

  it("shows published listings", async () => {
    const db = setup();
    await createDraftListing(db.d1, "owner", draftData(), { id: ID_A, slug: "visible-slug" });
    forcePublished(db, ID_A);
    expect((await getPublishedListingBySlug(db.d1, "visible-slug"))?.title).toBe("Public place");
    expect((await searchAll(db)).items.map((i) => i.id)).toEqual([ID_A]);
  });

  it("hides every non-published status from public queries", async () => {
    const db = setup();
    let n = 0;
    for (const status of ["draft", "pending", "paused", "rejected", "deleted"]) {
      const id = `cccccccc-cccc-4ccc-8ccc-${String(++n).padStart(12, "0")}`;
      await createDraftListing(db.d1, "owner", draftData(), { id, slug: `slug-${status}` });
      forcePublished(db, id, status);
      expect(await getPublishedListingBySlug(db.d1, `slug-${status}`)).toBeNull();
    }
    expect((await searchAll(db)).items).toEqual([]);
  });
});
