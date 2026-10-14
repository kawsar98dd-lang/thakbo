import { describe, expect, it } from "vitest";
import { MEDIA_LIMITS } from "~/lib/constants";
import { mimeFromKey } from "~/server/storage/media.server";
import { listListingImages, moveListingImage } from "~/server/db/repositories/images";
import { getImageForServing, removeImage, resolveImageAccess, uploadListingImage } from "~/server/image-service.server";
import { ADMIN_ID, JPEG_BYTES, PNG_BYTES, WEBP_BYTES, addImage, fakeBucket, insertAdmin, makeComplete, walkToStatus } from "./helpers/listings";
import { createTestDatabase, insertUser, type TestDatabase } from "./helpers/sqlite-d1";

const L = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function setup() {
  const db: TestDatabase = createTestDatabase();
  insertUser(db, "owner");
  insertUser(db, "other");
  db.raw.prepare("INSERT INTO listings (id, owner_id, slug, property_type) VALUES (?, 'owner', 'a', 'mess')").run(L);
  const bucket = fakeBucket();
  let n = 0;
  const deps = { db: db.d1, bucket, newId: () => `eeeeeeee-eeee-4eee-8eee-${String(++n).padStart(12, "0")}` };
  return { db, bucket, deps };
}

const rowCount = (db: TestDatabase) => (db.raw.prepare("SELECT count(*) AS n FROM listing_images").get() as { n: number }).n;

describe("uploading", () => {
  it("stores JPEG, PNG and WebP under a random key and registers the row", async () => {
    const { db, bucket, deps } = setup();
    for (const bytes of [JPEG_BYTES, PNG_BYTES, WEBP_BYTES]) expect(await uploadListingImage(deps, "owner", L, bytes)).toMatchObject({ ok: true });
    expect(rowCount(db)).toBe(3);
    const keys = [...bucket.objects.keys()];
    expect(keys).toHaveLength(3);
    // The stored content type comes from the file's bytes (never from the browser), one per real format.
    expect([...bucket.contentTypes.values()].sort()).toEqual(["image/jpeg", "image/png", "image/webp"]);
    for (const key of keys) expect(key).toMatch(/^listings\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/[0-9a-f-]{36}\.(jpg|png|webp)$/);
  });

  it("checks the file's real content, not its name or declared type", async () => {
    const { db, bucket, deps } = setup();
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
    for (const bytes of [html, gif, new Uint8Array(0)]) {
      expect(await uploadListingImage(deps, "owner", L, bytes)).toMatchObject({ ok: false, kind: "invalid_file" });
    }
    expect(rowCount(db)).toBe(0);
    expect(bucket.objects.size).toBe(0);
  });

  it("refuses files over 5 MB", async () => {
    const { bucket, deps } = setup();
    const big = new Uint8Array(MEDIA_LIMITS.maxImageBytes + 1);
    big.set(JPEG_BYTES);
    expect(await uploadListingImage(deps, "owner", L, big)).toMatchObject({ ok: false, kind: "invalid_file" });
    expect(bucket.objects.size).toBe(0);
  });

  it("enforces the 12-image limit", async () => {
    const { db, deps } = setup();
    for (let i = 0; i < MEDIA_LIMITS.maxImagesPerListing; i += 1) expect(await uploadListingImage(deps, "owner", L, JPEG_BYTES)).toMatchObject({ ok: true });
    expect(await uploadListingImage(deps, "owner", L, JPEG_BYTES)).toMatchObject({ ok: false, kind: "limit" });
    expect(rowCount(db)).toBe(12);
  });

  it("holds the limit even when uploads race", async () => {
    const { db, deps } = setup();
    for (let i = 0; i < 11; i += 1) addImage(db, L);
    const results = await Promise.all([uploadListingImage(deps, "owner", L, JPEG_BYTES), uploadListingImage(deps, "owner", L, PNG_BYTES), uploadListingImage(deps, "owner", L, WEBP_BYTES)]);
    expect(rowCount(db)).toBeLessThanOrEqual(12);
    expect(results.filter((r) => r.ok).length).toBeLessThanOrEqual(1);
  });

  it("only works for the owner and only while the listing is a draft or rejected", async () => {
    const { db, bucket, deps } = setup();
    expect(await uploadListingImage(deps, "other", L, JPEG_BYTES)).toMatchObject({ ok: false, kind: "not_found" });
    expect(await uploadListingImage(deps, "owner", "dddddddd-dddd-4ddd-8ddd-dddddddddddd", JPEG_BYTES)).toMatchObject({ ok: false, kind: "not_found" });
    makeComplete(db, L);
    walkToStatus(db, L, "pending");
    expect(await uploadListingImage(deps, "owner", L, JPEG_BYTES)).toMatchObject({ ok: false, kind: "not_editable" });
    walkToStatus(db, L, "rejected");
    expect(await uploadListingImage(deps, "owner", L, JPEG_BYTES)).toMatchObject({ ok: true });
    expect(bucket.objects.size).toBe(1);
  });
});

describe("storage failures", () => {
  it("leaves no database row when R2 fails", async () => {
    const { db, bucket, deps } = setup();
    bucket.failPut = true;
    expect(await uploadListingImage(deps, "owner", L, JPEG_BYTES)).toMatchObject({ ok: false, kind: "storage_error" });
    expect(rowCount(db)).toBe(0);
  });

  it("removes the uploaded file again when the database refuses the row", async () => {
    const { db, bucket, deps } = setup();
    // Simulates D1 refusing the insert after the file was already written to R2.
    db.raw.exec("CREATE TRIGGER fail_image BEFORE INSERT ON listing_images BEGIN SELECT RAISE(ABORT, 'simulated d1 failure'); END");
    expect(await uploadListingImage(deps, "owner", L, JPEG_BYTES)).toMatchObject({ ok: false, kind: "storage_error" });
    expect(bucket.objects.size).toBe(0);
    expect(rowCount(db)).toBe(0);
  });

  it("leaves a traceable orphan when both the database insert and R2 compensation fail", async () => {
    const { db, bucket, deps } = setup();
    // D1 rejects the row after R2 succeeds, and the compensating R2 delete also fails.
    db.raw.exec("CREATE TRIGGER fail_image BEFORE INSERT ON listing_images BEGIN SELECT RAISE(ABORT, 'simulated d1 failure'); END");
    bucket.failDelete = true;
    expect(await uploadListingImage(deps, "owner", L, JPEG_BYTES)).toMatchObject({ ok: false, kind: "storage_error" });
    expect(rowCount(db)).toBe(0);
    expect(bucket.objects.size).toBe(1);
    expect([...bucket.objects.keys()][0]).toMatch(/^listings\/[0-9a-f-]+\/[0-9a-f-]+\.jpg$/);
  });

  it("deletes the row first; a failing file delete only leaves an unreferenced file", async () => {
    const { db, bucket, deps } = setup();
    const uploaded = await uploadListingImage(deps, "owner", L, JPEG_BYTES);
    if (!uploaded.ok) throw new Error("setup failed");
    bucket.failDelete = true;
    expect(await removeImage(deps, "owner", L, uploaded.imageId)).toMatchObject({ ok: true });
    expect(rowCount(db)).toBe(0);
    expect(bucket.objects.size).toBe(1);
  });
});

describe("reordering", () => {
  it("moves a photo up or down and keeps the visible order contiguous", async () => {
    const { db } = setup();
    const first = addImage(db, L);
    const second = addImage(db, L);
    const third = addImage(db, L);

    expect(await moveListingImage(db.d1, { imageId: third, listingId: L, ownerId: "owner", direction: "up" })).toBe(true);
    expect((await listListingImages(db.d1, L)).map((image) => image.id)).toEqual([first, third, second]);
    expect((await listListingImages(db.d1, L)).map((image) => image.sortOrder)).toEqual([0, 1, 2]);

    expect(await moveListingImage(db.d1, { imageId: third, listingId: L, ownerId: "owner", direction: "down" })).toBe(true);
    expect((await listListingImages(db.d1, L)).map((image) => image.id)).toEqual([first, second, third]);
  });

  it("does not reorder an image when the submitted image id belongs to a different listing", async () => {
    const { db } = setup();
    const first = addImage(db, L);
    const secondListing = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    db.raw.prepare("INSERT INTO listings (id, owner_id, slug, property_type) VALUES (?, 'owner', 'second', 'mess')").run(secondListing);
    const foreignImage = addImage(db, secondListing);

    expect(await moveListingImage(db.d1, { imageId: foreignImage, listingId: L, ownerId: "owner", direction: "down" })).toBe(false);
    expect((await listListingImages(db.d1, L)).map((image) => image.id)).toEqual([first, second]);
    expect((await listListingImages(db.d1, secondListing)).map((image) => image.id)).toEqual([foreignImage]);
  });

  it("refuses boundary moves, another owner's listing, and non-editable listing statuses", async () => {
    const { db } = setup();
    const first = addImage(db, L);
    const second = addImage(db, L);
    expect(await moveListingImage(db.d1, { imageId: first, listingId: L, ownerId: "owner", direction: "up" })).toBe(false);
    expect(await moveListingImage(db.d1, { imageId: second, listingId: L, ownerId: "other", direction: "up" })).toBe(false);

    makeComplete(db, L);
    walkToStatus(db, L, "pending");
    expect(await moveListingImage(db.d1, { imageId: second, listingId: L, ownerId: "owner", direction: "up" })).toBe(false);
    expect((await listListingImages(db.d1, L)).map((image) => image.id)).toEqual([first, second]);
  });
});

describe("deleting", () => {
  it("cannot delete an image by pairing its id with another listing id", async () => {
    const { db, bucket, deps } = setup();
    const uploaded = await uploadListingImage(deps, "owner", L, JPEG_BYTES);
    if (!uploaded.ok) throw new Error("setup failed");
    const secondListing = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    db.raw.prepare("INSERT INTO listings (id, owner_id, slug, property_type) VALUES (?, 'owner', 'second', 'mess')").run(secondListing);

    expect(await removeImage(deps, "owner", secondListing, uploaded.imageId)).toMatchObject({ ok: false, kind: "not_found" });
    expect(rowCount(db)).toBe(1);
    expect(bucket.objects.size).toBe(1);
    expect(await getImageForServing(db.d1, uploaded.imageId)).toMatchObject({ ownerId: "owner", listingStatus: "draft" });
  });

  it("is owner-only and removes row and file", async () => {
    const { db, bucket, deps } = setup();
    const uploaded = await uploadListingImage(deps, "owner", L, JPEG_BYTES);
    if (!uploaded.ok) throw new Error("setup failed");
    expect(await removeImage(deps, "other", L, uploaded.imageId)).toMatchObject({ ok: false, kind: "not_found" });
    expect(rowCount(db)).toBe(1);
    expect(await removeImage(deps, "owner", L, uploaded.imageId)).toMatchObject({ ok: true });
    expect(rowCount(db)).toBe(0);
    expect(bucket.objects.size).toBe(0);
    expect(await listListingImages(db.d1, L)).toEqual([]);
  });
});

describe("who may see an image", () => {
  async function imageOf(db: TestDatabase, status: string) {
    makeComplete(db, L);
    const id = addImage(db, L);
    insertAdmin(db, ADMIN_ID, "admin");
    walkToStatus(db, L, status);
    const image = await getImageForServing(db.d1, id);
    if (!image) throw new Error("missing image");
    return image;
  }

  it("shows a published listing's image to anyone", async () => {
    const { db } = setup();
    const image = await imageOf(db, "published");
    expect(await resolveImageAccess(db.d1, image, null)).toBe("public");
  });

  it("hides draft images from everyone but the owner (admins included)", async () => {
    const { db } = setup();
    const image = await imageOf(db, "draft");
    expect(await resolveImageAccess(db.d1, image, null)).toBe("deny");
    expect(await resolveImageAccess(db.d1, image, "other")).toBe("deny");
    expect(await resolveImageAccess(db.d1, image, ADMIN_ID)).toBe("deny");
    expect(await resolveImageAccess(db.d1, image, "owner")).toBe("private");
  });

  it("shows pending and rejected images only to the owner and moderators, never to the public", async () => {
    for (const status of ["pending", "rejected", "paused"]) {
      const { db } = setup();
      const image = await imageOf(db, status);
      expect(await resolveImageAccess(db.d1, image, null)).toBe("deny");
      expect(await resolveImageAccess(db.d1, image, "other")).toBe("deny");
      expect(await resolveImageAccess(db.d1, image, "owner")).toBe("private");
      expect(await resolveImageAccess(db.d1, image, ADMIN_ID)).toBe("private");
    }
  });

  it("hides images of deleted listings from everyone", async () => {
    const { db } = setup();
    const image = await imageOf(db, "deleted");
    expect(await resolveImageAccess(db.d1, image, "owner")).toBe("deny");
    expect(await resolveImageAccess(db.d1, image, ADMIN_ID)).toBe("deny");
  });

  it("keeps image metadata and the R2 object after listing soft-delete, while denying image access", async () => {
    const { db, bucket, deps } = setup();
    const uploaded = await uploadListingImage(deps, "owner", L, JPEG_BYTES);
    if (!uploaded.ok) throw new Error("setup failed");
    const before = await getImageForServing(db.d1, uploaded.imageId);
    if (!before) throw new Error("image metadata missing before soft-delete");
    expect(bucket.objects.has(before.objectKey)).toBe(true);

    walkToStatus(db, L, "deleted");

    expect(await getImageForServing(db.d1, uploaded.imageId)).toMatchObject({ listingStatus: "deleted" });
    expect(rowCount(db)).toBe(1);
    expect(bucket.objects.has(before.objectKey)).toBe(true);
    const after = await getImageForServing(db.d1, uploaded.imageId);
    if (!after) throw new Error("image metadata missing after soft-delete");
    expect(await resolveImageAccess(db.d1, after, null)).toBe("deny");
    expect(await resolveImageAccess(db.d1, after, "owner")).toBe("deny");
    expect(await resolveImageAccess(db.d1, after, ADMIN_ID)).toBe("deny");
  });

  it("revokes private review-image access immediately when a moderator role is removed", async () => {
    const { db } = setup();
    const image = await imageOf(db, "pending");
    expect(await resolveImageAccess(db.d1, image, ADMIN_ID)).toBe("private");

    db.raw.prepare("DELETE FROM admin_users WHERE user_id = ?").run(ADMIN_ID);

    expect(await resolveImageAccess(db.d1, image, ADMIN_ID)).toBe("deny");
    expect(await resolveImageAccess(db.d1, image, "owner")).toBe("private");
    expect(await resolveImageAccess(db.d1, image, null)).toBe("deny");
  });

  it("does not grant review-image access to a regular user who is not in the moderator table", async () => {
    const { db } = setup();
    const image = await imageOf(db, "rejected");
    expect(await resolveImageAccess(db.d1, image, "other")).toBe("deny");
    expect(await resolveImageAccess(db.d1, image, ADMIN_ID)).toBe("private");
  });
});


describe("stored object-key validation", () => {
  it("recognizes only the generated listing UUID / image UUID layout", () => {
    expect(mimeFromKey(`listings/${L}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg`)).toBe("image/jpeg");
    expect(mimeFromKey(`listings/${L}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`)).toBe("image/png");
    expect(mimeFromKey(`listings/${L}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`)).toBe("image/webp");
  });

  it.each([
    "private/secret.jpg",
    `listings/${L}/../../secret.jpg`,
    `listings/${L}/not-a-uuid.jpg`,
    `listings/${L}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg/extra`,
    `listings/${L}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.svg`,
    `listings/${L.toUpperCase()}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg`,
    "listings//bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg",
  ])("rejects unexpected key %s", (key) => {
    expect(mimeFromKey(key)).toBeNull();
  });
});
