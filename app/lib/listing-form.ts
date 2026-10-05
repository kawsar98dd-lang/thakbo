import type { OwnedListingDetail } from "~/server/db/repositories/listings";
import type { AreaOption } from "~/server/db/repositories/locations";

/** Strings exactly as shown in the form fields (before validation). */
export interface ListingFormValues {
  propertyType: string;
  title: string;
  description: string;
  cityId: string;
  areaId: string;
  subAreaId: string;
  address: string;
  landmark: string;
  rentAmount: string;
  advanceAmount: string;
  mealCost: string;
  electricityCost: string;
  wifiCost: string;
  otherMonthlyCost: string;
  availabilityStatus: string;
  availableFrom: string;
  audiences: string[];
  facilityIds: string[];
}

/** What a listing form action sends back to the page. */
export interface ListingFormActionData {
  saved: boolean;
  errors: Record<string, string>;
  values: ListingFormValues | null;
  selectedArea: AreaOption | null;
  subAreas: AreaOption[];
}

export const EMPTY_LISTING_FORM: ListingFormValues = {
  propertyType: "",
  title: "",
  description: "",
  cityId: "",
  areaId: "",
  subAreaId: "",
  address: "",
  landmark: "",
  rentAmount: "",
  advanceAmount: "",
  mealCost: "",
  electricityCost: "",
  wifiCost: "",
  otherMonthlyCost: "",
  availabilityStatus: "available",
  availableFrom: "",
  audiences: [],
  facilityIds: [],
};

const text = (value: string | number | null | undefined): string => (value === null || value === undefined ? "" : String(value));

export function valuesFromForm(form: FormData): ListingFormValues {
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const many = (name: string) => form.getAll(name).filter((value): value is string => typeof value === "string");
  return {
    propertyType: field("propertyType"),
    title: field("title"),
    description: field("description"),
    cityId: field("cityId"),
    areaId: field("areaId"),
    subAreaId: field("subAreaId"),
    address: field("address"),
    landmark: field("landmark"),
    rentAmount: field("rentAmount"),
    advanceAmount: field("advanceAmount"),
    mealCost: field("mealCost"),
    electricityCost: field("electricityCost"),
    wifiCost: field("wifiCost"),
    otherMonthlyCost: field("otherMonthlyCost"),
    availabilityStatus: field("availabilityStatus") || "available",
    availableFrom: field("availableFrom"),
    audiences: many("audiences"),
    facilityIds: many("facilityIds"),
  };
}

export function valuesFromListing(listing: OwnedListingDetail): ListingFormValues {
  return {
    propertyType: listing.propertyType,
    title: text(listing.title),
    description: text(listing.description),
    cityId: text(listing.cityId),
    areaId: text(listing.areaId),
    subAreaId: text(listing.subAreaId),
    address: text(listing.address),
    landmark: text(listing.landmark),
    rentAmount: text(listing.rentAmount),
    advanceAmount: text(listing.advanceAmount),
    mealCost: text(listing.mealCost),
    electricityCost: text(listing.electricityCost),
    wifiCost: text(listing.wifiCost),
    otherMonthlyCost: text(listing.otherMonthlyCost),
    availabilityStatus: listing.availabilityStatus,
    availableFrom: text(listing.availableFrom),
    audiences: [...listing.audiences],
    facilityIds: listing.facilityIds.map(String),
  };
}
