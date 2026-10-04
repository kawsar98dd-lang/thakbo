import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "~/lib/validation/auth";
import { fieldErrors } from "~/lib/validation/common";
import { listingInputSchema } from "~/lib/validation/listing";
import { imageMetadataSchema } from "~/lib/validation/media";
import { parseSearchParams } from "~/lib/validation/search";

const sp = (query: string) => parseSearchParams(new URLSearchParams(query));

describe("auth validation", () => {
  it("normalises e-mail and accepts a valid registration", () => {
    const r = registerSchema.safeParse({ name: "Rahim", email: " RAHIM@Example.com ", password: "password1", confirmPassword: "password1" });
    expect(r.success && r.data.email).toBe("rahim@example.com");
  });
  it("rejects mismatched passwords and reports the right field", () => {
    const r = registerSchema.safeParse({ name: "Rahim", email: "a@b.co", password: "password1", confirmPassword: "other" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).confirmPassword).toBe("Passwords do not match.");
  });
  it("rejects short passwords", () => {
    expect(registerSchema.safeParse({ name: "Rahim", email: "a@b.co", password: "short", confirmPassword: "short" }).success).toBe(false);
  });
  it("login requires a valid email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
});

describe("search URL parsing", () => {
  it("parses the blueprint example URLs", () => {
    const s = sp("city=rajshahi&type=mess&audience=student&max_price=5000");
    expect(s).toMatchObject({ city: "rajshahi", types: ["mess"], audiences: ["student"], maxPrice: 5000, page: 1, sort: "newest" });
    expect(sp("city=rajshahi&area=talaimari")).toMatchObject({ city: "rajshahi", area: "talaimari" });
  });
  it("ignores invalid values instead of failing", () => {
    const s = sp("type=castle&audience=alien&max_price=abc&page=-4&sort=hax&city=Bad Slug!");
    expect(s.types).toEqual([]);
    expect(s.audiences).toEqual([]);
    expect(s.maxPrice).toBeUndefined();
    expect(s.page).toBe(1);
    expect(s.sort).toBe("newest");
    expect(s.city).toBeUndefined();
  });
  it("supports comma lists and repeated keys", () => {
    expect(sp("type=mess,room&type=flat").types.sort()).toEqual(["flat", "mess", "room"]);
  });
  it("only enables radius search when both coordinates are valid", () => {
    expect(sp("lat=24.37&radius=3").radiusKm).toBeUndefined();
    expect(sp("lat=24.37&lng=88.6&radius=3")).toMatchObject({ lat: 24.37, lng: 88.6, radiusKm: 3 });
  });
});

describe("listing input", () => {
  const valid = {
    propertyType: "mess", title: "Student mess near campus", cityId: "1", areaId: "2",
    latitude: "24.37", longitude: "88.6", rentAmount: "3000",
  };
  it("accepts a minimal valid listing and coerces form strings", () => {
    const r = listingInputSchema.safeParse(valid);
    expect(r.success && r.data.rentAmount).toBe(3000);
  });
  it("cannot be used to smuggle owner or status fields", () => {
    const r = listingInputSchema.safeParse({ ...valid, ownerId: "attacker", status: "published" });
    expect(r.success && Object.keys(r.data)).not.toContain("ownerId");
    expect(r.success && Object.keys(r.data)).not.toContain("status");
  });
  it("rejects out-of-range coordinates", () => {
    expect(listingInputSchema.safeParse({ ...valid, latitude: "120" }).success).toBe(false);
  });
});

describe("image metadata", () => {
  it("rejects wrong types and oversize files", () => {
    expect(imageMetadataSchema.safeParse({ name: "a.gif", type: "image/gif", size: 10 }).success).toBe(false);
    expect(imageMetadataSchema.safeParse({ name: "a.jpg", type: "image/jpeg", size: 6 * 1024 * 1024 }).success).toBe(false);
    expect(imageMetadataSchema.safeParse({ name: "a.jpg", type: "image/jpeg", size: 1000 }).success).toBe(true);
  });
});
