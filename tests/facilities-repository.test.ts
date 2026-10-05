import { describe, expect, it } from "vitest";
import {
  filterActiveFacilityIds,
  getFacilityById,
  getFacilityBySlug,
  listActiveFacilities,
} from "~/server/db/repositories/facilities";
import { createTestDatabase } from "./helpers/sqlite-d1";

describe("facility catalogue (database-driven)", () => {
  it("lists active facilities in display order with English and Bangla labels", async () => {
    const db = createTestDatabase();
    const facilities = await listActiveFacilities(db.d1);
    expect(facilities).toHaveLength(22);
    const slugs = facilities.map((f) => f.slug);
    for (const expected of ["wifi", "electricity", "water", "gas", "attached-bathroom", "shared-bathroom", "kitchen", "furnished",
      "semi-furnished", "parking", "lift", "generator-ips", "security", "cctv", "balcony", "dining", "fan", "ac", "washing-machine"]) {
      expect(slugs).toContain(expected);
    }
    expect(facilities.every((f) => f.nameEn !== null && f.nameBn !== null && f.category !== null)).toBe(true);
    expect(facilities[0]?.slug).toBe("wifi");
  });

  it("looks facilities up by slug and by id", async () => {
    const db = createTestDatabase();
    const wifi = await getFacilityBySlug(db.d1, "wifi");
    expect(wifi).toMatchObject({ nameEn: "Wi-Fi", nameBn: "ওয়াই-ফাই", category: "connectivity" });
    expect((await getFacilityById(db.d1, wifi?.id ?? 0))?.slug).toBe("wifi");
    expect(await getFacilityBySlug(db.d1, "nope")).toBeNull();
    expect(await getFacilityById(db.d1, 999999)).toBeNull();
  });

  it("hides inactive facilities everywhere", async () => {
    const db = createTestDatabase();
    db.raw.exec("UPDATE facilities SET is_active = 0 WHERE slug = 'wifi'");
    expect((await listActiveFacilities(db.d1)).map((f) => f.slug)).not.toContain("wifi");
    expect(await getFacilityBySlug(db.d1, "wifi")).toBeNull();
  });

  it("keeps only existing, active ids", async () => {
    const db = createTestDatabase();
    const wifi = await getFacilityBySlug(db.d1, "wifi");
    const fan = await getFacilityBySlug(db.d1, "fan");
    expect(await filterActiveFacilityIds(db.d1, [])).toEqual([]);
    expect(await filterActiveFacilityIds(db.d1, [wifi?.id ?? 0, 999999])).toEqual([wifi?.id]);
    db.raw.exec("UPDATE facilities SET is_active = 0 WHERE slug = 'fan'");
    expect(await filterActiveFacilityIds(db.d1, [fan?.id ?? 0])).toEqual([]);
  });
});
