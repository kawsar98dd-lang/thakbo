import { describe, expect, it } from "vitest";
import { getPublicListingExtras, isListingFavorite, isPublishedListingOwner, listFavoriteListings, submitListingReport, toggleListingFavorite } from "~/server/db/repositories/engagement";
import { createDraftListing } from "~/server/db/repositories/listings";
import { draftData, walkToStatus } from "./helpers/listings";
import { createTestDatabase, insertUser, seededAreaId, seededCityId } from "./helpers/sqlite-d1";

const LISTING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REPORT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function publishedListing(db: ReturnType<typeof createTestDatabase>, owner = "owner", slug = "public-place") {
  insertUser(db, owner);
  await createDraftListing(db.d1, owner, draftData({ title: "A public place", cityId: seededCityId(db), areaId: seededAreaId(db, "hetem-khan"), latitude: 24.37, longitude: 88.6 }), { id: LISTING_ID, slug });
  db.raw.prepare("UPDATE listings SET description = 'Near the university', landmark = 'University gate', rent_amount = 3500 WHERE id = ?").run(LISTING_ID);
  walkToStatus(db, LISTING_ID, "published");
}

describe("favorites and reports", () => {
  it("allows a signed-in non-owner to save and unsave a published listing", async () => {
    const db = createTestDatabase(); insertUser(db, "seeker"); await publishedListing(db);
    expect(await isListingFavorite(db.d1, "seeker", "public-place")).toBe(false);
    expect(await toggleListingFavorite(db.d1, "seeker", "public-place")).toBe(true);
    expect(await isListingFavorite(db.d1, "seeker", "public-place")).toBe(true);
    expect((await listFavoriteListings(db.d1, "seeker")).map((x) => x.slug)).toEqual(["public-place"]);
    expect(await toggleListingFavorite(db.d1, "seeker", "public-place")).toBe(false);
    expect(await listFavoriteListings(db.d1, "seeker")).toEqual([]);
  });

  it("does not let an owner save their own listing and identifies the owner for the public UI", async () => {
    const db = createTestDatabase(); await publishedListing(db);
    expect(await isPublishedListingOwner(db.d1, "owner", "public-place")).toBe(true);
    expect(await isPublishedListingOwner(db.d1, "seeker", "public-place")).toBe(false);
    expect(await isPublishedListingOwner(db.d1, "owner", "missing-place")).toBe(false);
    expect(await toggleListingFavorite(db.d1, "owner", "public-place")).toBe(false);
    expect(await listFavoriteListings(db.d1, "owner")).toEqual([]);
  });

  it("accepts one pending report and prevents duplicate pending reports by the same account", async () => {
    const db = createTestDatabase(); insertUser(db, "reporter"); await publishedListing(db);
    expect(await submitListingReport(db.d1, { id: REPORT_ID, slug: "public-place", reporterId: "reporter", reason: "wrong_information", details: "The rent is different." })).toBe(true);
    expect(await submitListingReport(db.d1, { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", slug: "public-place", reporterId: "reporter", reason: "spam", details: null })).toBe(false);
    expect(db.raw.prepare("SELECT status, reason FROM reports WHERE id = ?").get(REPORT_ID)).toMatchObject({ status: "pending", reason: "wrong_information" });
  });

  it("rejects reports for unpublished listings and reports from the listing owner", async () => {
    const db = createTestDatabase();
    await publishedListing(db);
    insertUser(db, "reporter");

    expect(await submitListingReport(db.d1, {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", slug: "public-place", reporterId: "owner",
      reason: "spam", details: "Owners must not report their own listing.",
    })).toBe(false);

    db.raw.prepare("UPDATE listings SET status = 'draft' WHERE id = ?").run(LISTING_ID);
    expect(await submitListingReport(db.d1, {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff", slug: "public-place", reporterId: "reporter",
      reason: "spam", details: "Unpublished listings should not be reportable.",
    })).toBe(false);
    expect(db.raw.prepare("SELECT COUNT(*) AS count FROM reports").get()).toMatchObject({ count: 0 });
  });

  it("allows a new report after the previous report is no longer pending", async () => {
    const db = createTestDatabase(); insertUser(db, "reporter"); await publishedListing(db);
    expect(await submitListingReport(db.d1, {
      id: REPORT_ID, slug: "public-place", reporterId: "reporter", reason: "wrong_information", details: null,
    })).toBe(true);
    db.raw.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").run(REPORT_ID);
    expect(await submitListingReport(db.d1, {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff", slug: "public-place", reporterId: "reporter", reason: "spam", details: null,
    })).toBe(true);
    expect(db.raw.prepare("SELECT COUNT(*) AS count FROM reports WHERE reporter_id = ?").get("reporter")).toMatchObject({ count: 2 });
  });

  it("limits each account to 10 reports in a rolling 24-hour window", async () => {
    const db = createTestDatabase(); insertUser(db, "reporter"); await publishedListing(db);
    for (let i = 0; i < 10; i++) {
      db.raw.prepare(
        "INSERT INTO reports (id, listing_id, reporter_id, reason, status) VALUES (?, ?, ?, 'spam', 'resolved')",
      ).run(`old-report-${i}`, LISTING_ID, "reporter");
    }
    expect(await submitListingReport(db.d1, {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", slug: "public-place", reporterId: "reporter",
      reason: "wrong_information", details: "An additional report should be blocked.",
    })).toBe(false);
  });

  it("does not return exact coordinates, address or storage keys in public extras", async () => {
    const db = createTestDatabase(); await publishedListing(db);
    db.raw.prepare("UPDATE listings SET address = 'Private exact address' WHERE id = ?").run(LISTING_ID);
    const extras = await getPublicListingExtras(db.d1, "public-place");
    expect(extras.landmark).toBe("University gate");
    expect(JSON.stringify(extras)).not.toContain("Private exact address");
    expect(JSON.stringify(extras)).not.toContain("88.6");
    expect(JSON.stringify(extras)).not.toContain("object_key");
  });
});
