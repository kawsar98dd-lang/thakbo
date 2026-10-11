import { checkCoordinates, checkNearCity } from "~/lib/coordinates";
import { canOwnerTransition, EDITABLE_STATUSES, SUBMITTABLE_STATUSES, type ListingStatus } from "~/lib/constants";
import { hasValidContact } from "~/lib/contact";
import { checkCompleteness, checkSubmissionReadiness, type FieldErrors, type ReadinessInput } from "~/lib/listing-readiness";
import { uniqueSlug } from "~/lib/utils";
import type { ListingDraftInput } from "~/lib/validation/listing";
import { filterActiveFacilityIds } from "./db/repositories/facilities";
import { countListingImages } from "./db/repositories/images";
import {
  createDraftListing,
  getOwnedListing,
  getOwnedListingDetail,
  setOwnedListingStatus,
  submitOwnedListing,
  updateOwnedListingContent,
  type DraftListingData,
  type OwnedListingDetail,
} from "./db/repositories/listings";
import { getCityCentre, isActiveAreaInCity, isActiveCity, isActiveSubAreaOf } from "./db/repositories/locations";
import { getProfile } from "./db/repositories/profiles";

/**
 * Business rules for listings that cannot be expressed in a single column constraint:
 *  - city / neighborhood / sub-area must be consistent and active,
 *  - facilities must exist and be active,
 *  - only the OWNER can change a listing; drafts and rejected listings are edited in place, a live listing that is
 *    edited goes back to moderation, and a listing under review is locked,
 *  - submission needs complete data, a valid contact number on the owner's profile and at least one photo.
 * `ownerId` is always the id from the verified session — never a value taken from the browser.
 */

export type { FieldErrors };

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
export type DraftReferences = Pick<ListingDraftInput, "cityId" | "areaId" | "subAreaId" | "facilityIds" | "latitude" | "longitude">;

export async function validateDraftReferences(db: D1Database, input: DraftReferences): Promise<FieldErrors> {
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

  // A supplied point must be a real point in Bangladesh and near the chosen city. The point is only CHECKED, never replaced.
  if (input.latitude !== undefined && input.longitude !== undefined) {
    const point = checkCoordinates(input.latitude, input.longitude);
    if (!point.ok) {
      errors.location = point.error;
    } else if (input.cityId !== undefined && errors.cityId === undefined) {
      const far = checkNearCity(point, await getCityCentre(db, input.cityId));
      if (far) errors.location = far;
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

const toReadiness = (detail: OwnedListingDetail, data?: DraftListingData): ReadinessInput => ({
  propertyType: data?.propertyType ?? detail.propertyType,
  title: data ? data.title : detail.title,
  description: data ? data.description : detail.description,
  cityId: data ? data.cityId : detail.cityId,
  areaId: data ? data.areaId : detail.areaId,
  // Coordinates are kept when the form sends none (same rule as the SQL COALESCE).
  latitude: data?.latitude ?? detail.latitude,
  longitude: data?.longitude ?? detail.longitude,
  rentAmount: data ? data.rentAmount : detail.rentAmount,
  availabilityStatus: data?.availabilityStatus ?? detail.availabilityStatus,
  availableFrom: data ? data.availableFrom : detail.availableFrom,
});

/**
 * Edits an owned listing. "Not yours" and "does not exist" are both reported as `not_found`,
 * so nobody can discover which listing ids exist.
 *  - draft: any partial data may be saved;
 *  - rejected: saved in place, but the data the database requires must be complete;
 *  - published / paused: the edit must be fully submission-ready; the listing leaves public search at once and goes
 *    back to `pending` (`wentOffline: true`);
 *  - pending / deleted: not editable (withdraw a pending listing first).
 */
export async function updateListing(
  db: D1Database,
  ownerId: string,
  listingId: string,
  input: ListingDraftInput,
): Promise<ServiceResult<{ listingId: string; wentOffline: boolean }>> {
  const current = await getOwnedListingDetail(db, listingId, ownerId);
  if (!current) return { ok: false, kind: "not_found" };
  if (!EDITABLE_STATUSES.includes(current.status)) return { ok: false, kind: "not_editable" };

  const errors: FieldErrors = await validateDraftReferences(db, input);
  const data = toDraftListingData(input);
  const wentOffline = current.status === "published" || current.status === "paused";

  if (Object.keys(errors).length === 0 && current.status !== "draft") {
    const readiness = toReadiness(current, data);
    const extra = wentOffline
      ? checkSubmissionReadiness(readiness, await submissionContext(db, ownerId, listingId, data.cityId))
      : checkCompleteness(readiness);
    Object.assign(errors, extra);
  }
  if (Object.keys(errors).length > 0) return { ok: false, kind: "invalid", errors };

  const updated = await updateOwnedListingContent(db, listingId, ownerId, data, EDITABLE_STATUSES);
  // Lost a race (deleted or status changed in between): treat as not editable.
  return updated ? { ok: true, listingId, wentOffline } : { ok: false, kind: "not_editable" };
}

async function submissionContext(db: D1Database, ownerId: string, listingId: string, cityId: number | null) {
  const [profile, imageCount, cityCentre] = await Promise.all([
    getProfile(db, ownerId),
    countListingImages(db, listingId),
    cityId ? getCityCentre(db, cityId) : Promise.resolve(null),
  ]);
  return { imageCount, contactOk: hasValidContact(profile), cityCentre };
}

/**
 * Sends a draft, a rejected or a paused listing to moderation. Re-checks everything on the server from the STORED
 * listing (never from the browser): required fields, a real location, a valid contact number on the owner's profile
 * and at least one photo. Returns every problem at once, keyed by field.
 */
export async function submitListing(db: D1Database, ownerId: string, listingId: string): Promise<ServiceResult<{ listingId: string }>> {
  const detail = await getOwnedListingDetail(db, listingId, ownerId);
  if (!detail) return { ok: false, kind: "not_found" };
  if (!SUBMITTABLE_STATUSES.includes(detail.status)) return { ok: false, kind: "not_allowed" };

  const errors: FieldErrors = await validateDraftReferences(db, {
    cityId: detail.cityId ?? undefined,
    areaId: detail.areaId ?? undefined,
    subAreaId: detail.subAreaId ?? undefined,
    facilityIds: detail.facilityIds,
    latitude: detail.latitude ?? undefined,
    longitude: detail.longitude ?? undefined,
  });
  Object.assign(errors, { ...checkSubmissionReadiness(toReadiness(detail), await submissionContext(db, ownerId, listingId, detail.cityId)), ...errors });
  if (Object.keys(errors).length > 0) return { ok: false, kind: "invalid", errors };

  // Compare-and-set: also re-checks ownership, status and "has a photo" inside the UPDATE itself.
  const submitted = await submitOwnedListing(db, listingId, ownerId, SUBMITTABLE_STATUSES);
  return submitted ? { ok: true, listingId } : { ok: false, kind: "not_allowed" };
}

/**
 * Owner status change, limited to the transitions in OWNER_STATUS_TRANSITIONS (compare-and-set in SQL).
 * Submitting for review is NOT possible here (use submitListing), and no owner transition leads to published/rejected.
 */
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

/** Pending listing: take it back to draft to change it (also used to take a live or rejected listing offline to edit photos). */
export function moveListingToDraft(db: D1Database, ownerId: string, listingId: string) {
  return changeOwnedListingStatus(db, ownerId, listingId, "draft");
}
