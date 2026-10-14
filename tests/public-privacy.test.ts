import { describe, expect, it } from "vitest";
import { parseSearchParams } from "~/lib/validation/search";
import { LISTING_CARD_COLUMNS } from "~/server/db/listing-search";
import { getPublishedListingBySlug, searchListings } from "~/server/db/repositories/listings";
import { makeSubmittable, setProfilePhone, walkToStatus } from "./helpers/listings";
import { createTestDatabase, insertUser, type TestDatabase } from "./helpers/sqlite-d1";

const L = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function setup(status: string): { db: TestDatabase; imageId: string } {
  const db = createTestDatabase();
  insertUser(db, "owner", "Owner Name");
  db.raw.prepare("INSERT INTO listings (id, owner_id, slug, property_type, address, landmark) VALUES (?, 'owner', 'secret-test', 'mess', '12 Private Lane, Block C', 'Behind the blue gate')").run(L);
  makeSubmittable(db, L);
  setProfilePhone(db, "owner", "01712345678", "01812345678");
  db.raw.prepare("UPDATE listings SET latitude = 24.37123, longitude = 88.60456 WHERE id = ?").run(L);
  walkToStatus(db, L, status);
  const imageId = (db.raw.prepare("SELECT id FROM listing_images WHERE listing_id = ? ORDER BY sort_order, id LIMIT 1").get(L) as { id: string }).id;
  return { db, imageId };
}

const FORBIDDEN = ["12 Private Lane", "Behind the blue gate", "24.37123", "88.60456", "01712345678", "01812345678", "8801712345678", L, "owner", "Owner Name", "owner@example.test", "listings/", ".jpg", "object_key", "objectKey", "latitude", "longitude", "address", "phone", "whatsapp", "ownerId"];

describe("anonymous responses never contain private data", () => {
  it("public search results", async () => {
    const { db } = setup("published");
    const result = await searchListings(db.d1, parseSearchParams(new URLSearchParams("")));
    expect(result.items).toHaveLength(1);
    const json = JSON.stringify(result);
    for (const secret of FORBIDDEN) expect(json).not.toContain(secret);
    expect(Object.keys(result.items[0] ?? {}).sort()).toEqual(
      ["approximateDistanceKm", "areaName", "areaSlug", "availabilityStatus", "citySlug", "cityName", "coverImageId", "mealCost", "electricityCost", "otherMonthlyCost", "propertyType", "rentAmount", "slug", "title", "updatedAt", "wifiCost"].sort(),
    );
  });

  it("the public listing page data", async () => {
    const { db } = setup("published");
    const listing = await getPublishedListingBySlug(db.d1, "secret-test");
    expect(listing).not.toBeNull();
    const json = JSON.stringify(listing);
    for (const secret of FORBIDDEN) expect(json).not.toContain(secret);
  });

  it("the search projection never selects ids, addresses, coordinates or object keys", () => {
    for (const forbidden of ["l.id,", "l.address", "l.latitude", "l.longitude", "object_key", "owner_id", "phone"]) {
      expect(LISTING_CARD_COLUMNS).not.toContain(forbidden);
    }
  });

  it("exposes the cover as an opaque image id that is not the storage key", async () => {
    const { db, imageId } = setup("published");
    const result = await searchListings(db.d1, parseSearchParams(new URLSearchParams("")));
    expect(result.items[0]?.coverImageId).toBe(imageId);
  });
});

describe("non-public listings are invisible to anonymous queries", () => {
  it("draft, pending, rejected, paused and deleted listings never appear", async () => {
    for (const status of ["draft", "pending", "rejected", "paused", "deleted"]) {
      const { db } = setup(status);
      expect((await searchListings(db.d1, parseSearchParams(new URLSearchParams("")))).items).toEqual([]);
      expect(await getPublishedListingBySlug(db.d1, "secret-test")).toBeNull();
    }
  });

  it("a soft-deleted listing remains invisible even when its slug is known", async () => {
    const { db } = setup("published");
    db.raw.prepare("UPDATE listings SET status = 'deleted' WHERE id = ?").run(L);
    expect((await searchListings(db.d1, parseSearchParams(new URLSearchParams("")))).items).toEqual([]);
    expect(await getPublishedListingBySlug(db.d1, "secret-test")).toBeNull();
    expect((db.raw.prepare("SELECT status FROM listings WHERE id = ?").get(L) as { status: string }).status).toBe("deleted");
  });

  it("a live listing disappears from public queries as soon as it goes back to review", async () => {
    const { db } = setup("published");
    db.raw.prepare("UPDATE listings SET status = 'pending' WHERE id = ?").run(L);
    expect((await searchListings(db.d1, parseSearchParams(new URLSearchParams("")))).items).toEqual([]);
    expect(await getPublishedListingBySlug(db.d1, "secret-test")).toBeNull();
  });
});
