import type { DraftListingData } from "~/server/db/repositories/listings";
import type { ListingDraftInput } from "~/lib/validation/listing";
import type { TestDatabase } from "./sqlite-d1";

/** Complete draft input with every field present (as zod would output it); override what a test cares about. */
export function draftInput(overrides: Partial<ListingDraftInput> = {}): ListingDraftInput {
  return {
    propertyType: "mess",
    title: "Student mess near campus",
    description: undefined,
    cityId: undefined,
    areaId: undefined,
    subAreaId: undefined,
    address: undefined,
    landmark: undefined,
    latitude: undefined,
    longitude: undefined,
    rentAmount: 3000,
    advanceAmount: undefined,
    mealCost: undefined,
    electricityCost: undefined,
    wifiCost: undefined,
    otherMonthlyCost: undefined,
    availabilityStatus: "available",
    availableFrom: undefined,
    audiences: [],
    facilityIds: [],
    ...overrides,
  };
}

export function draftData(overrides: Partial<DraftListingData> = {}): DraftListingData {
  return {
    propertyType: "mess",
    title: "Student mess near campus",
    description: null,
    cityId: null,
    areaId: null,
    subAreaId: null,
    address: null,
    landmark: null,
    latitude: null,
    longitude: null,
    rentAmount: 3000,
    advanceAmount: null,
    mealCost: null,
    electricityCost: null,
    wifiCost: null,
    otherMonthlyCost: null,
    availabilityStatus: "available",
    availableFrom: null,
    audiences: [],
    facilityIds: [],
    ...overrides,
  };
}

/** Deterministic id generator for tests. */
export function sequentialIds(prefix: string = "11111111-1111-4111-8111") {
  let counter = 0;
  return {
    id: () => `${prefix}-${String(++counter).padStart(12, "0")}`,
    slugSuffix: () => `s${counter}`,
  };
}

export function facilityId(db: TestDatabase, slug: string): number {
  const row = db.raw.prepare("SELECT id FROM facilities WHERE slug = ?").get(slug) as { id: number };
  return row.id;
}

/**
 * Fills the fields the database requires before a listing may leave draft status
 * (CHECK constraint on `listings`), so a test can then set any status.
 */
export function makeComplete(db: TestDatabase, listingId: string): void {
  const city = db.raw.prepare("SELECT id FROM cities WHERE slug = 'rajshahi'").get() as { id: number };
  const area = db.raw.prepare("SELECT id FROM areas WHERE slug = 'hetem-khan'").get() as { id: number };
  db.raw
    .prepare("UPDATE listings SET title = 'Complete listing', city_id = ?, area_id = ?, latitude = 24.37, longitude = 88.6, rent_amount = 3000 WHERE id = ?")
    .run(city.id, area.id, listingId);
}

export const ADMIN_ID = "admin-user";
export const MODERATOR_ID = "moderator-user";

/** Registers an existing or new user as admin/moderator (what the admin_users table means in production). */
export function insertAdmin(db: TestDatabase, id: string = ADMIN_ID, role: "admin" | "moderator" = "admin"): void {
  db.raw.prepare('INSERT OR IGNORE INTO "user" (id, name, email) VALUES (?, ?, ?)').run(id, id, `${id}@example.test`);
  db.raw.prepare("INSERT OR REPLACE INTO admin_users (user_id, role) VALUES (?, ?)").run(id, role);
}

let imageCounter = 0;
/** Adds one stored-image row (no real file) to a listing. */
export function addImage(db: TestDatabase, listingId: string): string {
  imageCounter += 1;
  const id = `bbbbbbbb-bbbb-4bbb-8bbb-${String(imageCounter).padStart(12, "0")}`;
  db.raw
    .prepare("INSERT INTO listing_images (id, listing_id, object_key, sort_order) VALUES (?, ?, ?, ?)")
    .run(id, listingId, `listings/${listingId}/${id}.jpg`, imageCounter);
  return id;
}

/** Everything submission needs: complete data, a description, a photo and a valid profile phone number. */
export function makeSubmittable(db: TestDatabase, listingId: string, ownerId: string = "owner"): void {
  makeComplete(db, listingId);
  db.raw.prepare("UPDATE listings SET description = 'A clean, quiet place close to the university.', property_type = 'mess' WHERE id = ?").run(listingId);
  addImage(db, listingId);
  setProfilePhone(db, ownerId, "01712345678");
}

export function setProfilePhone(db: TestDatabase, userId: string, phone: string | null, whatsapp: string | null = null): void {
  db.raw.prepare("INSERT OR IGNORE INTO profiles (user_id, display_name) VALUES (?, ?)").run(userId, userId);
  db.raw.prepare("UPDATE profiles SET phone = ?, whatsapp = ? WHERE user_id = ?").run(phone, whatsapp, userId);
}

/**
 * Moves a complete listing to `status` through LEGAL steps only (the 0008 triggers reject anything else):
 * draft → pending (needs a photo) → published/rejected (needs a registered reviewer) → paused.
 */
export function walkToStatus(db: TestDatabase, listingId: string, status: string, reviewerId: string = ADMIN_ID): void {
  const current = (db.raw.prepare("SELECT status FROM listings WHERE id = ?").get(listingId) as { status: string }).status;
  if (current === status) return;
  if (status === "deleted") {
    db.raw.prepare("UPDATE listings SET status = 'deleted' WHERE id = ?").run(listingId);
    return;
  }
  if (status === "draft") return;
  if (current === "draft") {
    if (!db.raw.prepare("SELECT 1 FROM listing_images WHERE listing_id = ?").get(listingId)) addImage(db, listingId);
    db.raw.prepare("UPDATE listings SET status = 'pending' WHERE id = ?").run(listingId);
  }
  if (status === "pending") return;
  insertAdmin(db, reviewerId);
  if (status === "rejected") {
    db.raw.prepare("UPDATE listings SET status = 'rejected', reviewed_by = ?, rejection_reason = 'Photos are too dark to see the room.' WHERE id = ?").run(reviewerId, listingId);
    return;
  }
  db.raw.prepare("UPDATE listings SET status = 'published', reviewed_by = ?, published_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(reviewerId, listingId);
  if (status === "paused") db.raw.prepare("UPDATE listings SET status = 'paused' WHERE id = ?").run(listingId);
}

export interface FakeBucket {
  objects: Map<string, Uint8Array>;
  failPut: boolean;
  failDelete: boolean;
  put(key: string, value: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
}

/** In-memory stand-in for the R2 binding, with switches to simulate storage failures. */
export function fakeBucket(): FakeBucket {
  const bucket: FakeBucket = {
    objects: new Map(),
    failPut: false,
    failDelete: false,
    async put(key, value) {
      if (bucket.failPut) throw new Error("R2 put failed");
      bucket.objects.set(key, value);
    },
    async delete(key) {
      if (bucket.failDelete) throw new Error("R2 delete failed");
      bucket.objects.delete(key);
    },
  };
  return bucket;
}

/** Smallest byte sequences that are real JPEG/PNG/WebP headers. */
export const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
export const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
