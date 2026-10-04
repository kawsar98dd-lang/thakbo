import { describe, expect, it } from "vitest";
import { estimateMonthlyCost } from "~/lib/cost";
import { boundingBox, distanceKm } from "~/lib/geo";

describe("distanceKm", () => {
  it("is zero for the same point", () => {
    expect(distanceKm({ latitude: 24.37, longitude: 88.6 }, { latitude: 24.37, longitude: 88.6 })).toBeCloseTo(0, 6);
  });
  it("matches a known distance (Dhaka to Rajshahi is roughly 200 km in a straight line)", () => {
    const d = distanceKm({ latitude: 23.8103, longitude: 90.4125 }, { latitude: 24.3745, longitude: 88.6042 });
    expect(d).toBeGreaterThan(190);
    expect(d).toBeLessThan(215);
  });
});

describe("boundingBox", () => {
  it("contains points inside the radius", () => {
    const center = { latitude: 24.37, longitude: 88.6 };
    const box = boundingBox(center, 3);
    const nearby = { latitude: 24.385, longitude: 88.615 }; // ~2.2 km away
    expect(distanceKm(center, nearby)).toBeLessThan(3);
    expect(nearby.latitude).toBeGreaterThanOrEqual(box.minLat);
    expect(nearby.latitude).toBeLessThanOrEqual(box.maxLat);
    expect(nearby.longitude).toBeGreaterThanOrEqual(box.minLng);
    expect(nearby.longitude).toBeLessThanOrEqual(box.maxLng);
  });
});

describe("estimateMonthlyCost", () => {
  it("adds recurring costs and ignores missing ones", () => {
    expect(estimateMonthlyCost({ rentAmount: 3000, mealCost: 2000, wifiCost: 200 })).toBe(5200);
  });
  it("returns null when rent is unknown", () => {
    expect(estimateMonthlyCost({ rentAmount: null, mealCost: 100 })).toBeNull();
  });
});
