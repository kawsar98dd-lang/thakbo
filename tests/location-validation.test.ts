import { describe, expect, it } from "vitest";
import { areaInputSchema, areaSearchSchema } from "~/lib/validation/location";

describe("area search request", () => {
  it("accepts a city with optional text and parent", () => {
    expect(areaSearchSchema.safeParse({ cityId: "1" }).success).toBe(true);
    const result = areaSearchSchema.safeParse({ cityId: "1", q: " হেতেম ", parentId: "4" });
    expect(result.success && result.data).toMatchObject({ cityId: 1, q: "হেতেম", parentId: 4 });
  });

  it("rejects missing or invalid city ids and overlong text", () => {
    expect(areaSearchSchema.safeParse({ cityId: null }).success).toBe(false);
    expect(areaSearchSchema.safeParse({ cityId: "abc" }).success).toBe(false);
    expect(areaSearchSchema.safeParse({ cityId: "-1" }).success).toBe(false);
    expect(areaSearchSchema.safeParse({ cityId: "1", q: "x".repeat(81) }).success).toBe(false);
    expect(areaSearchSchema.safeParse({ cityId: "1", parentId: "0" }).success).toBe(false);
  });

  it("treats an empty query as no query", () => {
    const result = areaSearchSchema.safeParse({ cityId: "1", q: "" });
    expect(result.success && result.data.q).toBeUndefined();
  });
});

describe("area input (future admin screens)", () => {
  const valid = { cityId: 1, name: "Hetem Khan", nameBn: "হেতেম খান", slug: "hetem-khan" };

  it("accepts a neighborhood with defaults", () => {
    const result = areaInputSchema.safeParse(valid);
    expect(result.success && result.data).toMatchObject({ areaType: "neighborhood", searchPriority: 0, aliases: [] });
  });

  it("validates type, slug, coordinates and aliases", () => {
    expect(areaInputSchema.safeParse({ ...valid, areaType: "galaxy" }).success).toBe(false);
    expect(areaInputSchema.safeParse({ ...valid, slug: "Not A Slug" }).success).toBe(false);
    expect(areaInputSchema.safeParse({ ...valid, latitude: "24.3", longitude: "88.6" }).success).toBe(true);
    expect(areaInputSchema.safeParse({ ...valid, latitude: "24.3" }).success).toBe(false);
    expect(areaInputSchema.safeParse({ ...valid, latitude: "95", longitude: "88" }).success).toBe(false);
    expect(areaInputSchema.safeParse({ ...valid, aliases: ["Hatem Khan", ""] }).success).toBe(false);
    expect(areaInputSchema.safeParse({ ...valid, radiusM: "0" }).success).toBe(false);
  });
});
