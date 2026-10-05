import { describe, expect, it } from "vitest";
import { fieldErrors } from "~/lib/validation/common";
import { formToObject } from "~/lib/validation/form";
import {
  LISTING_DRAFT_FIELDS,
  LISTING_DRAFT_MULTI_FIELDS,
  listingDraftInputSchema,
} from "~/lib/validation/listing";

const parse = (input: Record<string, unknown>) => listingDraftInputSchema.safeParse(input);

function errorsOf(input: Record<string, unknown>): Record<string, string> {
  const result = parse(input);
  return result.success ? {} : fieldErrors(result.error);
}

describe("draft validation: what a draft needs", () => {
  it("accepts a draft that only has a property type", () => {
    const result = parse({ propertyType: "room" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.audiences).toEqual([]);
      expect(result.data.facilityIds).toEqual([]);
      expect(result.data.availabilityStatus).toBe("available");
    }
  });

  it("accepts a full draft submitted as form strings and converts the numbers", () => {
    const result = parse({
      propertyType: "mess_seat", title: "Seat in a student mess", description: "Quiet and clean", cityId: "1", areaId: "9", subAreaId: "",
      address: "House 12", landmark: "Near the mosque", rentAmount: "2500", advanceAmount: "5000", mealCost: "", wifiCost: "200",
      availabilityStatus: "available_from", availableFrom: "2026-11-01", audiences: ["student", "male", "student"], facilityIds: ["1", "2", "2"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ cityId: 1, areaId: 9, rentAmount: 2500, advanceAmount: 5000, wifiCost: 200, availableFrom: "2026-11-01" });
      expect(result.data.mealCost).toBeUndefined();
      expect(result.data.subAreaId).toBeUndefined();
      expect(result.data.audiences).toEqual(["student", "male"]);
      expect(result.data.facilityIds).toEqual([1, 2]);
    }
  });

  it("requires a valid property type", () => {
    expect(errorsOf({}).propertyType).toBeTruthy();
    expect(errorsOf({ propertyType: "castle" }).propertyType).toBeTruthy();
  });
});

describe("draft validation: text", () => {
  it("rejects a too short or too long title and an overlong description", () => {
    expect(errorsOf({ propertyType: "mess", title: "abc" }).title).toContain("too short");
    expect(errorsOf({ propertyType: "mess", title: "x".repeat(121) }).title).toContain("too long");
    expect(errorsOf({ propertyType: "mess", description: "x".repeat(5001) }).description).toBeTruthy();
  });

  it("treats blank optional text as missing", () => {
    const result = parse({ propertyType: "mess", title: "   ", description: "", address: " ", landmark: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBeUndefined();
  });
});

describe("draft validation: money", () => {
  it("rejects negative, fractional, huge and non-numeric amounts", () => {
    for (const field of ["rentAmount", "advanceAmount", "mealCost", "electricityCost", "wifiCost", "otherMonthlyCost"]) {
      expect(errorsOf({ propertyType: "mess", [field]: "-1" })[field]).toBeTruthy();
      expect(errorsOf({ propertyType: "mess", [field]: "10.5" })[field]).toBeTruthy();
      expect(errorsOf({ propertyType: "mess", [field]: "100000001" })[field]).toBeTruthy();
      expect(errorsOf({ propertyType: "mess", [field]: "abc" })[field]).toBeTruthy();
    }
  });

  it("accepts zero and the maximum, and never turns a blank into 0", () => {
    expect(parse({ propertyType: "mess", rentAmount: "0" }).success).toBe(true);
    expect(parse({ propertyType: "mess", rentAmount: "100000000" }).success).toBe(true);
    const blank = parse({ propertyType: "mess", rentAmount: "", advanceAmount: "  " });
    expect(blank.success && blank.data.rentAmount).toBeUndefined();
    expect(blank.success && blank.data.advanceAmount).toBeUndefined();
  });
});

describe("draft validation: coordinates", () => {
  it("accepts valid pairs and rejects out-of-range values", () => {
    expect(parse({ propertyType: "mess", latitude: "24.37", longitude: "88.6" }).success).toBe(true);
    expect(errorsOf({ propertyType: "mess", latitude: "90.1", longitude: "88.6" }).latitude).toBeTruthy();
    expect(errorsOf({ propertyType: "mess", latitude: "-90.1", longitude: "88.6" }).latitude).toBeTruthy();
    expect(errorsOf({ propertyType: "mess", latitude: "24", longitude: "180.5" }).longitude).toBeTruthy();
    expect(errorsOf({ propertyType: "mess", latitude: "24", longitude: "-181" }).longitude).toBeTruthy();
    expect(errorsOf({ propertyType: "mess", latitude: "abc", longitude: "88" }).latitude).toBeTruthy();
  });

  it("requires both coordinates or neither", () => {
    expect(errorsOf({ propertyType: "mess", latitude: "24.3" }).latitude).toContain("both");
    expect(errorsOf({ propertyType: "mess", longitude: "88.3" }).latitude).toContain("both");
  });
});

describe("draft validation: location and availability rules", () => {
  it("needs a city before a neighborhood, and a neighborhood before a sub-area", () => {
    expect(errorsOf({ propertyType: "mess", areaId: "5" }).cityId).toBeTruthy();
    expect(errorsOf({ propertyType: "mess", cityId: "1", subAreaId: "7" }).subAreaId).toBeTruthy();
    expect(parse({ propertyType: "mess", cityId: "1", areaId: "5", subAreaId: "7" }).success).toBe(true);
  });

  it("rejects non-positive and non-numeric ids", () => {
    for (const bad of ["0", "-2", "1.5", "abc"]) {
      expect(errorsOf({ propertyType: "mess", cityId: bad }).cityId).toBeTruthy();
    }
  });

  it("requires a date for 'available from' and validates it", () => {
    expect(errorsOf({ propertyType: "mess", availabilityStatus: "available_from" }).availableFrom).toBeTruthy();
    expect(errorsOf({ propertyType: "mess", availableFrom: "01/11/2026" }).availableFrom).toBeTruthy();
    expect(errorsOf({ propertyType: "mess", availabilityStatus: "soon" }).availabilityStatus).toBeTruthy();
  });

  it("limits audiences to the known list and facility ids to positive integers", () => {
    expect(errorsOf({ propertyType: "mess", audiences: ["aliens"] }).audiences).toBeTruthy();
    expect(parse({ propertyType: "mess", audiences: ["mixed", "anyone"] }).success).toBe(true);
    expect(errorsOf({ propertyType: "mess", facilityIds: ["1", "x"] }).facilityIds).toBeTruthy();
    expect(errorsOf({ propertyType: "mess", facilityIds: ["0"] }).facilityIds).toBeTruthy();
    expect(errorsOf({ propertyType: "mess", facilityIds: Array.from({ length: 51 }, (_, i) => String(i + 1)) }).facilityIds).toBeTruthy();
  });
});

describe("draft validation: mass assignment", () => {
  it("never reads owner, status, slug or id from a submitted form", () => {
    const form = new FormData();
    form.set("propertyType", "mess");
    form.set("ownerId", "attacker");
    form.set("owner_id", "attacker");
    form.set("status", "published");
    form.set("slug", "hijacked");
    form.set("id", "someone-elses-listing");
    form.append("facilityIds", "1");
    form.append("facilityIds", "2");
    const object = formToObject(form, LISTING_DRAFT_FIELDS, LISTING_DRAFT_MULTI_FIELDS);
    expect(Object.keys(object)).not.toContain("ownerId");
    expect(Object.keys(object)).not.toContain("status");
    expect(Object.keys(object)).not.toContain("slug");
    expect(object.facilityIds).toEqual(["1", "2"]);
    const parsed = listingDraftInputSchema.parse(object);
    expect(Object.keys(parsed)).not.toContain("ownerId");
    expect(Object.keys(parsed)).not.toContain("status");
  });

  it("also strips unknown keys when the schema is fed an arbitrary object", () => {
    const parsed = listingDraftInputSchema.parse({ propertyType: "mess", ownerId: "x", status: "published", slug: "y" });
    expect(Object.keys(parsed)).not.toContain("ownerId");
    expect(Object.keys(parsed)).not.toContain("slug");
  });
});
