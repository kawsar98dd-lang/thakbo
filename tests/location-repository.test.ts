import { describe, expect, it } from "vitest";
import { normalizeLocationText } from "~/lib/location";
import {
  addAreaAlias,
  createArea,
  createCity,
  getAreaBySlug,
  getCityBySlug,
  isActiveAreaInCity,
  isActiveCity,
  isActiveSubAreaOf,
  listActiveAreas,
  listActiveCities,
  listActiveCitiesByDistrict,
  listActiveCountries,
  listActiveDistricts,
  listActiveDivisions,
  listActiveSubAreas,
  listAreaAliases,
  removeAreaAlias,
  resolveAreaByText,
  searchAreas,
  setAreaActive,
} from "~/server/db/repositories/locations";
import { createTestDatabase, insertSecondCity, loadSeeds, seededAreaId, seededCityId } from "./helpers/sqlite-d1";

const slugs = (areas: Array<{ slug: string }>) => areas.map((a) => a.slug);

describe("seed data (representative Rajshahi neighborhoods)", () => {
  it("contains Hetem Khan, Ghoshpara, Shaheb Bazar and Talaimari with Bangla names and types", () => {
    const db = createTestDatabase();
    const rows = db.raw
      .prepare("SELECT slug, name_en AS nameEn, name_bn AS nameBn, area_type AS areaType FROM areas WHERE slug IN (?, ?, ?, ?) ORDER BY slug")
      .all("hetem-khan", "ghoshpara", "shaheb-bazar", "talaimari");
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.nameBn)).toEqual(["ঘোষপাড়া", "হেতেম খান", "সাহেব বাজার", "তালাইমারী"]);
    expect(db.raw.prepare("SELECT area_type FROM areas WHERE slug = 'shaheb-bazar'").get()).toMatchObject({ area_type: "market_area" });
  });

  it("stores NULL coordinates instead of invented ones", () => {
    const db = createTestDatabase();
    const row = db.raw.prepare("SELECT count(*) AS n FROM areas WHERE latitude IS NOT NULL OR longitude IS NOT NULL").get();
    expect(row).toMatchObject({ n: 0 });
  });

  it("stores normalized aliases exactly as normalizeLocationText computes them", () => {
    const db = createTestDatabase();
    const aliases = db.raw.prepare("SELECT alias, normalized_alias AS normalizedAlias FROM area_aliases").all() as Array<{ alias: string; normalizedAlias: string }>;
    expect(aliases.length).toBeGreaterThan(20);
    const mismatches = aliases.filter((a) => normalizeLocationText(a.alias) !== a.normalizedAlias);
    expect(mismatches).toEqual([]);
  });

  it("gives every area its canonical English and Bangla names as aliases", async () => {
    const db = createTestDatabase();
    const cityId = seededCityId(db);
    for (const area of await listActiveAreas(db.d1, cityId)) {
      expect((await resolveAreaByText(db.d1, cityId, area.name))?.id).toBe(area.id);
      if (area.nameBn) expect((await resolveAreaByText(db.d1, cityId, area.nameBn))?.id).toBe(area.id);
    }
  });

  it("can be loaded twice without creating duplicates", () => {
    const db = createTestDatabase();
    const count = () =>
      db.raw
        .prepare("SELECT (SELECT count(*) FROM areas) AS areas, (SELECT count(*) FROM area_aliases) AS aliases, (SELECT count(*) FROM facilities) AS facilities")
        .get();
    const before = count();
    loadSeeds(db.raw);
    loadSeeds(db.raw);
    expect(count()).toEqual(before);
    expect(before).toMatchObject({ areas: 10, aliases: 25, facilities: 22 });
  });
});

describe("alias resolution (Bangla, English and spelling variations)", () => {
  it("resolves every Hetem Khan spelling to the one canonical area", async () => {
    const db = createTestDatabase();
    const cityId = seededCityId(db);
    for (const text of ["Hetem Khan", "hetem  khan", "Hatem Khan", "হেতেম খান", "হেটেম খান", "হাতেম খান"]) {
      const area = await resolveAreaByText(db.d1, cityId, text);
      expect(area?.slug).toBe("hetem-khan");
    }
  });

  it("resolves Shaheb Bazar spellings, spaced or not", async () => {
    const db = createTestDatabase();
    const cityId = seededCityId(db);
    for (const text of ["Shaheb Bazar", "Saheb Bazar", "সাহেব বাজার", "সাহেববাজার"]) {
      expect((await resolveAreaByText(db.d1, cityId, text))?.slug).toBe("shaheb-bazar");
    }
  });

  it("does not resolve unknown text, and never merges different places", async () => {
    const db = createTestDatabase();
    const cityId = seededCityId(db);
    expect(await resolveAreaByText(db.d1, cityId, "Atlantis")).toBeNull();
    expect(await resolveAreaByText(db.d1, cityId, "   ")).toBeNull();
    expect((await resolveAreaByText(db.d1, cityId, "Hatem Khan"))?.slug).not.toBe("ghoshpara");
  });

  it("scopes aliases to a city", async () => {
    const db = createTestDatabase();
    const other = insertSecondCity(db);
    expect(await resolveAreaByText(db.d1, other.cityId, "Hetem Khan")).toBeNull();
  });

  it("rejects duplicate aliases inside one city", async () => {
    const db = createTestDatabase();
    const ghoshpara = seededAreaId(db, "ghoshpara");
    const result = await addAreaAlias(db.d1, ghoshpara, "Hatem Khan");
    expect(result).toMatchObject({ ok: false, reason: "alias_conflict", conflictingAreaId: seededAreaId(db, "hetem-khan") });
  });

  it("treats re-adding an alias to its own area as a harmless no-op, and rejects empty text", async () => {
    const db = createTestDatabase();
    const hetem = seededAreaId(db, "hetem-khan");
    expect(await addAreaAlias(db.d1, hetem, "hatem  KHAN")).toMatchObject({ ok: true });
    expect(await addAreaAlias(db.d1, hetem, " - ")).toMatchObject({ ok: false, reason: "empty_alias" });
    expect(await addAreaAlias(db.d1, 999999, "Whatever")).toMatchObject({ ok: false, reason: "area_not_found" });
  });

  it("adds new spellings that resolve immediately, and removes them again", async () => {
    const db = createTestDatabase();
    const cityId = seededCityId(db);
    const hetem = seededAreaId(db, "hetem-khan");
    expect(await addAreaAlias(db.d1, hetem, "Hatem Kan")).toMatchObject({ ok: true });
    expect((await resolveAreaByText(db.d1, cityId, "hatem kan"))?.slug).toBe("hetem-khan");
    const alias = (await listAreaAliases(db.d1, hetem)).find((a) => a.alias === "Hatem Kan");
    expect(alias?.language).toBe("en");
    expect(await removeAreaAlias(db.d1, hetem, alias?.id ?? 0)).toBe(true);
    expect(await resolveAreaByText(db.d1, cityId, "hatem kan")).toBeNull();
  });
});

describe("neighborhood search (server-side autocomplete)", () => {
  it("finds Hetem Khan from partial English, spelling-variant and Bangla input", async () => {
    const db = createTestDatabase();
    const cityId = seededCityId(db);
    for (const query of ["Hetem", "Hatem", "hetem k", "হেতেম", "হেটেম", "হাতেম"]) {
      expect(slugs(await searchAreas(db.d1, cityId, query))).toEqual(["hetem-khan"]);
    }
  });

  it("finds Shaheb Bazar from Bangla without a space", async () => {
    const db = createTestDatabase();
    expect(slugs(await searchAreas(db.d1, seededCityId(db), "সাহেববাজার"))).toEqual(["shaheb-bazar"]);
    expect(slugs(await searchAreas(db.d1, seededCityId(db), "saheb"))).toEqual(["shaheb-bazar"]);
  });

  it("reports which alias matched", async () => {
    const db = createTestDatabase();
    const [hit] = await searchAreas(db.d1, seededCityId(db), "hatem");
    expect(hit?.matchedAlias).toBe("Hatem Khan");
  });

  it("returns each area once even when several of its aliases match", async () => {
    const db = createTestDatabase();
    const result = await searchAreas(db.d1, seededCityId(db), "khan");
    expect(slugs(result)).toEqual(["hetem-khan"]);
  });

  it("returns nothing for unrelated text", async () => {
    const db = createTestDatabase();
    expect(await searchAreas(db.d1, seededCityId(db), "xqxq")).toEqual([]);
    expect(await searchAreas(db.d1, seededCityId(db), "zzzz-qq")).toEqual([]);
  });

  it("returns the most important neighborhoods when the query is empty or too short", async () => {
    const db = createTestDatabase();
    const result = await searchAreas(db.d1, seededCityId(db), "");
    expect(result[0]?.slug).toBe("shaheb-bazar");
    expect(result.length).toBeGreaterThan(3);
    expect(slugs(await searchAreas(db.d1, seededCityId(db), "h"))).toEqual(slugs(result));
  });

  it("respects the result limit", async () => {
    const db = createTestDatabase();
    expect(await searchAreas(db.d1, seededCityId(db), "", { limit: 3 })).toHaveLength(3);
  });

  it("never lets LIKE wildcards in the query act as wildcards", async () => {
    const db = createTestDatabase();
    const cityId = seededCityId(db);
    // "%" and "_" are removed by normalization, so "ha%" behaves exactly like "ha" and "%%" like an empty query.
    expect(slugs(await searchAreas(db.d1, cityId, "ha%"))).toEqual(slugs(await searchAreas(db.d1, cityId, "ha")));
    expect(slugs(await searchAreas(db.d1, cityId, "%%"))).toEqual(slugs(await searchAreas(db.d1, cityId, "")));
    expect(await searchAreas(db.d1, cityId, "x_q%")).toEqual([]);
  });

  it("is isolated per city", async () => {
    const db = createTestDatabase();
    const other = insertSecondCity(db);
    expect(await searchAreas(db.d1, other.cityId, "hetem")).toEqual([]);
  });
});

describe("inactive locations", () => {
  it("hide an inactive area from lists, search, resolution and relationship checks", async () => {
    const db = createTestDatabase();
    const cityId = seededCityId(db);
    const hetem = seededAreaId(db, "hetem-khan");
    expect(await setAreaActive(db.d1, hetem, false)).toBe(true);
    expect(slugs(await listActiveAreas(db.d1, cityId))).not.toContain("hetem-khan");
    expect(await searchAreas(db.d1, cityId, "hetem")).toEqual([]);
    expect(await resolveAreaByText(db.d1, cityId, "Hatem Khan")).toBeNull();
    expect(await getAreaBySlug(db.d1, cityId, "hetem-khan")).toBeNull();
    expect(await isActiveAreaInCity(db.d1, cityId, hetem)).toBe(false);
  });

  it("can be re-activated", async () => {
    const db = createTestDatabase();
    const hetem = seededAreaId(db, "hetem-khan");
    await setAreaActive(db.d1, hetem, false);
    await setAreaActive(db.d1, hetem, true);
    expect(await isActiveAreaInCity(db.d1, seededCityId(db), hetem)).toBe(true);
  });

  it("hide a whole city when any administrative ancestor is inactive", async () => {
    const db = createTestDatabase();
    const cityId = seededCityId(db);
    expect(await isActiveCity(db.d1, cityId)).toBe(true);
    db.raw.exec("UPDATE districts SET is_active = 0");
    expect(await listActiveCities(db.d1)).toEqual([]);
    expect(await getCityBySlug(db.d1, "rajshahi")).toBeNull();
    expect(await isActiveCity(db.d1, cityId)).toBe(false);
    expect(await isActiveAreaInCity(db.d1, cityId, seededAreaId(db, "talaimari"))).toBe(false);
    expect(await searchAreas(db.d1, cityId, "talaimari")).toEqual([]);
  });
});

describe("hierarchy queries", () => {
  it("walks country → division → district → city → areas", async () => {
    const db = createTestDatabase();
    const [country] = await listActiveCountries(db.d1);
    expect(country?.code).toBe("BD");
    const [division] = await listActiveDivisions(db.d1, country?.id ?? 0);
    expect(division?.slug).toBe("rajshahi");
    const [district] = await listActiveDistricts(db.d1, division?.id ?? 0);
    const [city] = await listActiveCitiesByDistrict(db.d1, district?.id ?? 0);
    expect(city).toMatchObject({ slug: "rajshahi", nameBn: "রাজশাহী" });
    const areas = await listActiveAreas(db.d1, city?.id ?? 0);
    expect(areas).toHaveLength(10);
    expect((await listActiveCities(db.d1)).map((c) => c.slug)).toEqual(["rajshahi"]);
  });

  it("supports a second city with no code change", async () => {
    const db = createTestDatabase();
    const district = db.raw.prepare("SELECT id FROM districts LIMIT 1").get() as { id: number };
    const created = await createCity(db.d1, { districtId: district.id, name: "Dhaka", nameBn: "ঢাকা", slug: "dhaka" });
    expect(created.ok).toBe(true);
    expect((await listActiveCities(db.d1)).map((c) => c.slug)).toEqual(["dhaka", "rajshahi"]);
    expect(await createCity(db.d1, { districtId: district.id, name: "Dhaka", slug: "dhaka" })).toMatchObject({ ok: false, reason: "slug_taken" });
  });
});

describe("city ↔ area relationship", () => {
  it("accepts a neighborhood of the same city and rejects one of another city", async () => {
    const db = createTestDatabase();
    const other = insertSecondCity(db);
    const rajshahi = seededCityId(db);
    const hetem = seededAreaId(db, "hetem-khan");
    expect(await isActiveAreaInCity(db.d1, rajshahi, hetem)).toBe(true);
    expect(await isActiveAreaInCity(db.d1, other.cityId, hetem)).toBe(false);
    expect(await isActiveAreaInCity(db.d1, rajshahi, other.areaId)).toBe(false);
    expect(await isActiveAreaInCity(db.d1, rajshahi, 999999)).toBe(false);
  });
});

describe("creating areas and sub-areas (admin foundation)", () => {
  it("creates a neighborhood with automatic canonical aliases that resolve and search", async () => {
    const db = createTestDatabase();
    const cityId = seededCityId(db);
    const result = await createArea(db.d1, {
      cityId, name: "Greater Road", nameBn: "গ্রেটার রোড", slug: "greater-road", areaType: "road_area",
      aliases: ["Greater Rd"], searchPriority: 40,
    });
    expect(result.ok).toBe(true);
    expect((await resolveAreaByText(db.d1, cityId, "গ্রেটার রোড"))?.slug).toBe("greater-road");
    expect((await resolveAreaByText(db.d1, cityId, "greater rd"))?.slug).toBe("greater-road");
    expect(slugs(await searchAreas(db.d1, cityId, "greater"))).toEqual(["greater-road"]);
    expect(await getAreaBySlug(db.d1, cityId, "greater-road")).toMatchObject({ areaType: "road_area" });
  });

  it("rejects a duplicate slug and an alias that belongs to another area (nothing is written)", async () => {
    const db = createTestDatabase();
    const cityId = seededCityId(db);
    expect(await createArea(db.d1, { cityId, name: "Other", slug: "hetem-khan" })).toMatchObject({ ok: false, reason: "slug_taken" });
    const conflict = await createArea(db.d1, { cityId, name: "New Place", slug: "new-place", aliases: ["Hatem Khan"] });
    expect(conflict).toMatchObject({ ok: false, reason: "alias_conflict" });
    expect(await getAreaBySlug(db.d1, cityId, "new-place")).toBeNull();
  });

  it("creates sub-areas under a neighborhood of the same city only", async () => {
    const db = createTestDatabase();
    const cityId = seededCityId(db);
    const other = insertSecondCity(db);
    const hetem = seededAreaId(db, "hetem-khan");
    const ok = await createArea(db.d1, { cityId, name: "Hetem Khan Bazar Road", slug: "hetem-khan-bazar-road", parentAreaId: hetem });
    expect(ok.ok).toBe(true);
    const sub = (await listActiveSubAreas(db.d1, hetem))[0];
    expect(sub?.slug).toBe("hetem-khan-bazar-road");
    expect(await isActiveSubAreaOf(db.d1, hetem, sub?.id ?? 0)).toBe(true);
    expect(await isActiveSubAreaOf(db.d1, seededAreaId(db, "ghoshpara"), sub?.id ?? 0)).toBe(false);
    expect(await createArea(db.d1, { cityId: other.cityId, name: "Wrong", slug: "wrong", parentAreaId: hetem })).toMatchObject({ ok: false, reason: "parent_not_found" });
    // sub-areas are not offered as top-level neighborhoods
    expect(slugs(await listActiveAreas(db.d1, cityId))).not.toContain("hetem-khan-bazar-road");
  });
});
