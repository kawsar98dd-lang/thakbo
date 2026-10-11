import { describe, expect, it } from "vitest";
import { checkCoordinates, checkNearCity, parseLocationInput, resolveLocationFields } from "~/lib/coordinates";
import { hasValidContact, normalizeContactNumber } from "~/lib/contact";
import { checkCompleteness, checkSubmissionReadiness, type ReadinessInput } from "~/lib/listing-readiness";
import { validateRejectionReason } from "~/lib/moderation";

describe("coordinate validation", () => {
  it("accepts a point inside Bangladesh and rounds noise", () => {
    expect(checkCoordinates(24.3745, 88.6042)).toEqual({ ok: true, latitude: 24.3745, longitude: 88.6042 });
    expect(checkCoordinates(24.370000000000001, 88.6)).toMatchObject({ ok: true, latitude: 24.37 });
  });

  it("rejects missing, malformed, non-finite and out-of-country values", () => {
    for (const [lat, lng] of [[null, 88], [24, undefined], [Number.NaN, 88], [Infinity, 88], ["24.3", "88.6"], [91, 88], [24, 181], [0, 0], [40.7, -74], [10, 90]] as const) {
      expect(checkCoordinates(lat, lng).ok).toBe(false);
    }
  });

  it("only checks the distance to a city centre when a centre is known", () => {
    const rajshahi = { latitude: 24.3745, longitude: 88.6042 };
    expect(checkNearCity({ latitude: 24.38, longitude: 88.61 }, rajshahi)).toBeNull();
    expect(checkNearCity({ latitude: 23.81, longitude: 90.41 }, rajshahi)).toContain("far from the selected city");
    expect(checkNearCity({ latitude: 23.81, longitude: 90.41 }, null)).toBeNull();
  });
});

describe("pasted Google Maps locations (parsed locally, never fetched)", () => {
  it("reads the supported formats", () => {
    expect(parseLocationInput("24.3745, 88.6042")).toEqual({ ok: true, latitude: 24.3745, longitude: 88.6042 });
    expect(parseLocationInput("https://www.google.com/maps/@24.3745,88.6042,17z")).toMatchObject({ ok: true, latitude: 24.3745, longitude: 88.6042 });
    expect(parseLocationInput("https://www.google.com/maps/place/Home/@24.4,88.7,17z/data=!4m6!3d24.3745!4d88.6042")).toMatchObject({ ok: true, latitude: 24.3745, longitude: 88.6042 });
    expect(parseLocationInput("https://maps.google.com/?q=24.3745,88.6042")).toMatchObject({ ok: true, latitude: 24.3745 });
    expect(parseLocationInput("https://www.google.com/maps?ll=24.3745,88.6042&z=15")).toMatchObject({ ok: true, longitude: 88.6042 });
    expect(parseLocationInput("My place: https://www.google.com/maps?q=24.3745,88.6042 thanks")).toMatchObject({ ok: true });
  });

  it("refuses short links, other sites, plain http, junk and coordinates outside Bangladesh", () => {
    expect(parseLocationInput("https://maps.app.goo.gl/abc123")).toEqual({ ok: false, reason: "short_link" });
    expect(parseLocationInput("https://evil.example/maps?q=24.3,88.6")).toEqual({ ok: false, reason: "unsupported" });
    expect(parseLocationInput("http://www.google.com/maps?q=24.3,88.6")).toEqual({ ok: false, reason: "unsupported" });
    expect(parseLocationInput("https://www.google.com/search?q=24.3,88.6")).toEqual({ ok: false, reason: "unsupported" });
    expect(parseLocationInput("hello")).toEqual({ ok: false, reason: "unsupported" });
    expect(parseLocationInput("   ")).toEqual({ ok: false, reason: "empty" });
    expect(parseLocationInput("https://www.google.com/maps?q=40.7,-74.0")).toEqual({ ok: false, reason: "out_of_range" });
    expect(parseLocationInput("https://www.google.com/maps/@99999,88,17z")).toMatchObject({ ok: false });
  });

  it("uses a pasted link only when the form has no coordinates, and never invents a value", () => {
    expect(resolveLocationFields({ latitude: "", longitude: "", link: "24.3745, 88.6042" })).toEqual({ latitude: "24.3745", longitude: "88.6042" });
    expect(resolveLocationFields({ latitude: "24.1", longitude: "88.1", link: "24.3745, 88.6042" })).toEqual({ latitude: "24.1", longitude: "88.1" });
    expect(resolveLocationFields({ latitude: "", longitude: "", link: "" })).toEqual({ latitude: "", longitude: "" });
    expect(resolveLocationFields({ latitude: "", longitude: "", link: "nonsense" }).error).toBeTruthy();
  });
});

describe("contact numbers", () => {
  it("accepts Bangladesh mobile numbers and international numbers, rejects junk", () => {
    expect(normalizeContactNumber("01712-345678")).toBe("+8801712345678");
    expect(normalizeContactNumber("+880 1712 345678")).toBe("+8801712345678");
    expect(normalizeContactNumber("+14155552671")).toBe("+14155552671");
    for (const bad of ["", "   ", "12345", "0171234", "01012345678", "abcdefghijk", null, undefined]) {
      expect(normalizeContactNumber(bad as string | null | undefined)).toBeNull();
    }
  });

  it("needs at least one valid method", () => {
    expect(hasValidContact({ phone: null, whatsapp: null })).toBe(false);
    expect(hasValidContact({ phone: "123", whatsapp: "01712345678" })).toBe(true);
    expect(hasValidContact(null)).toBe(false);
  });
});

const READY: ReadinessInput = {
  propertyType: "mess", title: "Student mess near campus", description: "A clean and quiet place near the university.",
  cityId: 1, areaId: 2, latitude: 24.37, longitude: 88.6, rentAmount: 3000, availabilityStatus: "available", availableFrom: null,
};

describe("readiness rules", () => {
  it("passes a complete listing", () => {
    expect(checkSubmissionReadiness(READY, { imageCount: 1, contactOk: true })).toEqual({});
  });

  it("reports every problem at once, keyed by field", () => {
    const errors = checkSubmissionReadiness({ ...READY, title: "", description: "short", areaId: null, latitude: null, rentAmount: 0 }, { imageCount: 0, contactOk: false });
    expect(Object.keys(errors).sort()).toEqual(["areaId", "contact", "description", "images", "location", "rentAmount", "title"]);
  });

  it("completeness ignores photo and contact (draft-level data only)", () => {
    expect(checkCompleteness(READY)).toEqual({});
    expect(checkCompleteness({ ...READY, longitude: 200 }).location).toBeTruthy();
  });

  it("requires a date when availability is 'available from'", () => {
    expect(checkSubmissionReadiness({ ...READY, availabilityStatus: "available_from" }, { imageCount: 1, contactOk: true }).availableFrom).toBeTruthy();
  });
});

describe("rejection reason validation", () => {
  it("requires 10 to 500 plain characters", () => {
    expect(validateRejectionReason("Photos are too dark.")).toEqual({ ok: true, reason: "Photos are too dark." });
    for (const bad of [undefined, null, 42, "", "   ", "too short", "x".repeat(501), "bad\u0000reason here"]) expect(validateRejectionReason(bad).ok).toBe(false);
    expect(validateRejectionReason("x".repeat(500)).ok).toBe(true);
  });
});
