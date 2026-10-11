import { checkCoordinates, checkNearCity } from "./coordinates";
import type { GeoPoint } from "./geo";

/**
 * "Is this listing ready?" rules, as pure functions so they can be tested without a database.
 *  - checkCompleteness: what the database itself demands of any non-draft listing (CHECK constraint on `listings`).
 *  - checkSubmissionReadiness: completeness plus everything a moderator needs (description, contact, photo, valid place).
 * Errors are keyed by form field name so the form can show them next to the right input.
 */

export type FieldErrors = Record<string, string>;

export interface ReadinessInput {
  propertyType: string | null | undefined;
  title: string | null | undefined;
  description: string | null | undefined;
  cityId: number | null | undefined;
  areaId: number | null | undefined;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  rentAmount: number | null | undefined;
  availabilityStatus: string | null | undefined;
  availableFrom: string | null | undefined;
}

export const READINESS_LIMITS = { titleMin: 5, descriptionMin: 20 } as const;

export function checkCompleteness(input: ReadinessInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.title || input.title.trim().length < READINESS_LIMITS.titleMin) errors.title = "Enter a title (at least 5 characters).";
  if (!input.cityId) errors.cityId = "Choose a city.";
  if (!input.areaId) errors.areaId = "Choose a neighborhood.";
  if (input.rentAmount === null || input.rentAmount === undefined) errors.rentAmount = "Enter the monthly rent.";
  const location = checkCoordinates(input.latitude, input.longitude);
  if (!location.ok) errors.location = location.error;
  return errors;
}

export interface SubmissionContext {
  imageCount: number;
  contactOk: boolean;
  cityCentre?: GeoPoint | null;
}

export function checkSubmissionReadiness(input: ReadinessInput, context: SubmissionContext): FieldErrors {
  const errors = checkCompleteness(input);
  if (!input.propertyType) errors.propertyType = "Choose a property type.";
  if (!input.description || input.description.trim().length < READINESS_LIMITS.descriptionMin) {
    errors.description = "Describe the place (at least 20 characters).";
  }
  if (typeof input.rentAmount === "number" && input.rentAmount <= 0) errors.rentAmount = "Enter a monthly rent greater than zero.";
  if (input.availabilityStatus === "available_from" && !input.availableFrom) {
    errors.availableFrom = "Choose the date from which the place is available.";
  }

  if (errors.location === undefined && typeof input.latitude === "number" && typeof input.longitude === "number") {
    const far = checkNearCity({ latitude: input.latitude, longitude: input.longitude }, context.cityCentre);
    if (far) errors.location = far;
  }
  if (context.imageCount < 1) errors.images = "Add at least one photo before submitting.";
  if (!context.contactOk) {
    errors.contact = "Add a valid phone or WhatsApp number to your profile so people can reach you.";
  }
  return errors;
}
