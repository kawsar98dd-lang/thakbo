import { z } from "zod";
import { AUDIENCES, AVAILABILITY_STATUSES, PROPERTY_TYPES } from "../constants";
import { emptyToUndefined, optionalText } from "./common";

const taka = z.coerce.number().int("Enter a whole number.").min(0).max(100_000_000);
const optionalTaka = z.preprocess((v) => (v == null ? undefined : emptyToUndefined(v)), taka.optional());

/**
 * Fields a user may submit when creating/editing a listing.
 * Deliberately EXCLUDES owner_id, status, slug and timestamps: those are decided by the server.
 */
export const listingInputSchema = z.object({
  propertyType: z.enum(PROPERTY_TYPES),
  title: z.string().trim().min(5, "Title is too short.").max(120),
  description: optionalText(5000),
  cityId: z.coerce.number().int().positive(),
  areaId: z.coerce.number().int().positive(),
  address: optionalText(300),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  rentAmount: taka,
  advanceAmount: optionalTaka,
  mealCost: optionalTaka,
  electricityCost: optionalTaka,
  wifiCost: optionalTaka,
  otherMonthlyCost: optionalTaka,
  availabilityStatus: z.enum(AVAILABILITY_STATUSES).default("available"),
  availableFrom: z.iso.date().optional(),
  audiences: z.array(z.enum(AUDIENCES)).max(AUDIENCES.length).default([]),
  facilityIds: z.array(z.coerce.number().int().positive()).max(50).default([]),
});

export type ListingInput = z.infer<typeof listingInputSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Draft listings (Milestone 2). A draft may be incomplete, so almost everything is optional — but whatever IS
// provided must be valid. Ownership, status and slug are never accepted from the client.
// ---------------------------------------------------------------------------------------------------------------

const optionalId = z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional());
const optionalCoordinate = (min: number, max: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().min(min).max(max).optional());

/** Fields read from a submitted form (everything else is ignored by formToObject). */
export const LISTING_DRAFT_FIELDS = [
  "propertyType",
  "title",
  "description",
  "cityId",
  "areaId",
  "subAreaId",
  "address",
  "landmark",
  "latitude",
  "longitude",
  "rentAmount",
  "advanceAmount",
  "mealCost",
  "electricityCost",
  "wifiCost",
  "otherMonthlyCost",
  "availabilityStatus",
  "availableFrom",
  "audiences",
  "facilityIds",
] as const;

/** Fields that can carry several values (checkbox groups). */
export const LISTING_DRAFT_MULTI_FIELDS = ["audiences", "facilityIds"] as const;

const uniqueIds = (ids: number[]) => [...new Set(ids)];

export const listingDraftInputSchema = z
  .object({
    propertyType: z.enum(PROPERTY_TYPES, { error: "Choose a property type." }),
    title: z.preprocess(emptyToUndefined, z.string().trim().min(5, "Title is too short.").max(120, "Title is too long.").optional()),
    description: optionalText(5000),
    cityId: optionalId,
    areaId: optionalId,
    subAreaId: optionalId,
    address: optionalText(300),
    landmark: optionalText(200),
    latitude: optionalCoordinate(-90, 90),
    longitude: optionalCoordinate(-180, 180),
    rentAmount: optionalTaka,
    advanceAmount: optionalTaka,
    mealCost: optionalTaka,
    electricityCost: optionalTaka,
    wifiCost: optionalTaka,
    otherMonthlyCost: optionalTaka,
    availabilityStatus: z.enum(AVAILABILITY_STATUSES).default("available"),
    availableFrom: z.preprocess(emptyToUndefined, z.iso.date("Enter a valid date.").optional()),
    audiences: z
      .array(z.enum(AUDIENCES))
      .max(AUDIENCES.length)
      .default([])
      .transform((values) => [...new Set(values)]),
    facilityIds: z.array(z.coerce.number().int().positive()).max(50).default([]).transform(uniqueIds),
  })
  .refine((value) => value.areaId === undefined || value.cityId !== undefined, {
    message: "Choose a city first.",
    path: ["cityId"],
  })
  .refine((value) => value.subAreaId === undefined || value.areaId !== undefined, {
    message: "Choose the neighborhood first.",
    path: ["subAreaId"],
  })
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
    message: "Provide both latitude and longitude, or neither.",
    path: ["latitude"],
  })
  .refine((value) => value.availabilityStatus !== "available_from" || value.availableFrom !== undefined, {
    message: "Choose the date from which the place is available.",
    path: ["availableFrom"],
  });

export type ListingDraftInput = z.infer<typeof listingDraftInputSchema>;
