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
