import { z } from "zod";
import { AUDIENCES, AVAILABILITY_STATUSES, PROPERTY_TYPES } from "../constants";
import { optionalText } from "./common";

const taka = z.coerce.number().int("Enter a whole number.").min(0).max(100_000_000);
const optionalTaka = z.preprocess((v) => (v === "" || v == null ? undefined : v), taka.optional());

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
