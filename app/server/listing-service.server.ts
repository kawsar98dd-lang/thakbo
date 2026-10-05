import { canOwnerTransition, type ListingStatus } from "~/lib/constants";
import { uniqueSlug } from "~/lib/utils";
import type { ListingDraftInput } from "~/lib/validation/listing";
import { filterActiveFacilityIds } from "./db/repositories/facilities";
import {
  createDraftListing,
  getOwnedListing,
  setOwnedListingStatus,
  updateOwnedDraft,
  type DraftListingData,
} from "./db/repositories/listings";
import { isActiveAreaInCity, isActiveCity, isActiveSubAreaOf } from "./db/repositories/locations";

/**
 * Business rules for listings that cannot be expressed in a single column constraint:
 *  - city / neighborhood / sub-area must be consistent and active,
 *  - facilities must exist and be active,
 *  - only the OWNER can change a listing, and only DRAFTS can be edited.
 * `ownerId` is always the id from the verified session — never a value taken from the browser.
 */

export type FieldErrors = Record<string, string>;

export type ServiceFailure =
  | { ok: false; kind: "invalid"; errors: FieldErrors }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_editable" }
  | { ok: false; kind: "not_allowed" };

export type ServiceResult<T> = ({ ok: true } & T) | ServiceFailure;

export interface IdGenerator {
  id(): string;
  slugSuffix(): string;
}

/** Production ids: random UUID and a 6-hex-character slug suffix (Web Crypto, available in Workers). */
export const randomIds: IdGenerator = {
  id: () => crypto.randomUUID(),
  slugSuffix: () =>
    Array.from(crypto.getRandomValues(new Uint8Array(3)), (byte) => byte.toString(16).padStart(2, "0")).join(""),
};

export function toDraftListingData(input: ListingDraftInput): DraftListingData {
  return {
    propertyType: input.propertyType,
    title: input.title ?? null,
    description: input.description ?? null,
    cityId: input.cityId ?? null,
    areaId: input.areaId ?? null,
    subAreaId: input.subAreaId ?? null,
    address: input.address ?? null,
    landmark: input.landmark ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    rentAmount: input.rentAmount ?? null,
    advanceAmount: input.advanceAmount ?? null,
    mealCost: input.mealCost ?? null,
    electricityCost: input.electricityCost ?? null,
    wifiCost: input.wifiCost ?? null,
    otherMonthlyCost: input.otherMonthlyCost ?? null,
    availabilityStatus: input.availabilityStatus,
    availableFrom: input.availableFrom ?? null,
    audiences: input.audiences,
    facilityIds: input.facilityIds,
  };
}

/**
 * Server-side relationship checks (the browser's dropdowns are never trusted).
 * A neighborhood from another city, an inactive place or an unknown facility is rejected with a safe message.
 */
export async function validateDraftReferences(db: D1Database, input: ListingDraftInput): Promise<FieldErrors> {
  const errors: FieldErrors = {};

  if (input.cityId !== undefined && !(await isActiveCity(db, input.cityId))) {
    errors.cityId = "Choose a city from the list.";
  }

  if (input.areaId !== undefined && errors.cityId === undefined) {
    if (input.cityId === undefined || !(await isActiveAreaInCity(db, input.cityId, input.areaId))) {
      errors.areaId = "Choose a neighborhood that belongs to the selected city.";
    }
  }

  if (input.subAreaId !== undefined && input.areaId !== undefined && errors.areaId === undefined && errors.cityId === undefined) {
    if (!(await isActiveSubAreaOf(db, input.areaId, input.subAreaId))) {
      errors.subAreaId = "Choose a sub-area that belongs to the selected neighborhood.";
    }
  }

  if (input.facilityIds.length > 0) {
    const valid = await filterActiveFacilityIds(db, input.facilityIds);
    if (valid.length !== input.facilityIds.length) errors.facilityIds = "One of the selected facilities is not available.";
  }

  return errors;
}

/** Creates a draft owned by `ownerId`. A draft never becomes public: its status is fixed to 'draft'. */
export async function createListingDraft(
  db: D1Database,
  ownerId: string,
  input: ListingDraftInput,
  ids: IdGenerator = randomIds,
): Promise<ServiceResult<{ listingId: string }>> {
  const errors = await validateDraftReferences(db, input);
  if (Object.keys(errors).length > 0) return { ok: false, kind: "invalid", errors };

  const listingId = ids.id();
  const slug = uniqueSlug(input.title ?? "listing", ids.slugSuffix());
  await createDraftListing(db, ownerId, toDraftListingData(input), { id: listingId, slug });
  return { ok: true, listingId };
}

/**
 * Edits an owned draft. "Not yours" and "does not exist" are both reported as `not_found`,
 * so nobody can discover which listing ids exist.
 */
export async function updateListingDraft(
  db: D1Database,
  ownerId: string,
  listingId: string,
  input: ListingDraftInput,
): Promise<ServiceResult<{ listingId: string }>> {
  const current = await getOwnedListing(db, listingId, ownerId);
  if (!current) return { ok: false, kind: "not_found" };
  if (current.status !== "draft") return { ok: false, kind: "not_editable" };

  const errors = await validateDraftReferences(db, input);
  if (Object.keys(errors).length > 0) return { ok: false, kind: "invalid", errors };

  const updated = await updateOwnedDraft(db, listingId, ownerId, toDraftListingData(input));
  // Lost a race (deleted or status changed in between): treat as not editable.
  return updated ? { ok: true, listingId } : { ok: false, kind: "not_editable" };
}

/** Owner status change, limited to the transitions in OWNER_STATUS_TRANSITIONS (compare-and-set in SQL). */
export async function changeOwnedListingStatus(
  db: D1Database,
  ownerId: string,
  listingId: string,
  to: ListingStatus,
): Promise<ServiceResult<{ listingId: string }>> {
  const current = await getOwnedListing(db, listingId, ownerId);
  if (!current) return { ok: false, kind: "not_found" };
  if (!canOwnerTransition(current.status, to)) return { ok: false, kind: "not_allowed" };
  const changed = await setOwnedListingStatus(db, listingId, ownerId, current.status, to);
  return changed ? { ok: true, listingId } : { ok: false, kind: "not_allowed" };
}

/** Soft delete (status 'deleted'): the row stays for history but disappears from every normal query. */
export function deleteOwnedListing(db: D1Database, ownerId: string, listingId: string) {
  return changeOwnedListingStatus(db, ownerId, listingId, "deleted");
}
