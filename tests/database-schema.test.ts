import { describe, expect, it } from "vitest";
import { applyMigration, createTestDatabase, insertUser, seededAreaId, seededCityId, type TestDatabase } from "./helpers/sqlite-d1";

/** Runs a statement that the database must reject; returns the error message ("" if it was wrongly accepted). */
function rejection(db: TestDatabase, sql: string, ...params: Array<string | number | null>): string {
  try {
    db.raw.prepare(sql).run(...params);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

const INSERT_LISTING = "INSERT INTO listings (id, owner_id, slug, property_type) VALUES (?, ?, ?, ?)";

describe("migrations", () => {
  it("apply cleanly in order and leave no foreign-key violations", () => {
    const db = createTestDatabase();
    expect(db.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    const tables = (db.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((t) => t.name);
    for (const expected of ["user", "profiles", "countries", "divisions", "districts", "cities", "areas", "area_aliases", "facilities", "listings", "listing_facilities", "listing_audiences", "favorites", "reports", "admin_users"]) {
      expect(tables).toContain(expected);
    }
  });

  it("keep existing audience rows when migration 0007 rebuilds the table", () => {
    const db = createTestDatabase({ stopBefore: "0007" });
    insertUser(db, "u1");
    db.raw.prepare(INSERT_LISTING).run("l1", "u1", "l1", "mess");
    db.raw.prepare("INSERT INTO listing_audiences (listing_id, audience) VALUES ('l1', 'student')").run();
    applyMigration(db, "0007");
    expect(db.raw.prepare("SELECT listing_id, audience FROM listing_audiences").all()).toEqual([{ listing_id: "l1", audience: "student" }]);
    db.raw.prepare("INSERT INTO listing_audiences (listing_id, audience) VALUES ('l1', 'anyone')").run();
    expect(db.raw.prepare("SELECT count(*) AS n FROM listing_audiences").get()).toMatchObject({ n: 2 });
  });

  it("keep existing location data when 0006 adds the neighborhood columns", () => {
    const db = createTestDatabase({ stopBefore: "0006" });
    db.raw.exec("INSERT INTO countries (name, slug, code) VALUES ('Bangladesh', 'bangladesh', 'BD')");
    db.raw.exec("INSERT INTO divisions (country_id, name, slug) VALUES (1, 'Rajshahi', 'rajshahi')");
    db.raw.exec("INSERT INTO districts (division_id, name, slug) VALUES (1, 'Rajshahi', 'rajshahi')");
    db.raw.exec("INSERT INTO cities (district_id, name, slug) VALUES (1, 'Rajshahi', 'rajshahi')");
    db.raw.exec("INSERT INTO areas (city_id, name, slug) VALUES (1, 'Talaimari', 'talaimari')");
    applyMigration(db, "0006");
    expect(db.raw.prepare("SELECT name, name_en, area_type, is_active, search_priority FROM areas").get()).toMatchObject({
      name: "Talaimari", name_en: "Talaimari", area_type: "neighborhood", is_active: 1, search_priority: 0,
    });
    expect(db.raw.prepare("SELECT name_en FROM cities").get()).toMatchObject({ name_en: "Rajshahi" });
  });
});

describe("location constraints", () => {
  it("rejects duplicate area slugs within a city but allows them across cities", () => {
    const db = createTestDatabase();
    const city = seededCityId(db);
    expect(rejection(db, "INSERT INTO areas (city_id, name, slug) VALUES (?, 'Dup', 'talaimari')", city)).toContain("UNIQUE");
    db.raw.exec("INSERT INTO cities (district_id, name, slug) VALUES (1, 'Other City', 'other-city')");
    const other = (db.raw.prepare("SELECT id FROM cities WHERE slug = 'other-city'").get() as { id: number }).id;
    expect(rejection(db, "INSERT INTO areas (city_id, name, slug) VALUES (?, 'Talaimari', 'talaimari')", other)).toBe("");
  });

  it("rejects an ambiguous alias (same normalized text twice in one city)", () => {
    const db = createTestDatabase();
    const city = seededCityId(db);
    const ghoshpara = seededAreaId(db, "ghoshpara");
    expect(rejection(db, "INSERT INTO area_aliases (area_id, city_id, alias, normalized_alias) VALUES (?, ?, 'Hatem Khan', 'hatemkhan')", ghoshpara, city)).toContain("UNIQUE");
  });

  it("rejects invalid area types, coordinates and radius", () => {
    const db = createTestDatabase();
    const city = seededCityId(db);
    expect(rejection(db, "INSERT INTO areas (city_id, name, slug, area_type) VALUES (?, 'X', 'x1', 'galaxy')", city)).toContain("CHECK");
    expect(rejection(db, "INSERT INTO areas (city_id, name, slug, latitude) VALUES (?, 'X', 'x2', 123)", city)).toContain("CHECK");
    expect(rejection(db, "INSERT INTO areas (city_id, name, slug, radius_m) VALUES (?, 'X', 'x3', 0)", city)).toContain("CHECK");
  });

  it("removes aliases together with their area, and blocks deleting a parent that has sub-areas", () => {
    const db = createTestDatabase();
    const city = seededCityId(db);
    db.raw.prepare("INSERT INTO areas (city_id, name, slug, parent_area_id) VALUES (?, 'Child', 'child', ?)").run(city, seededAreaId(db, "kazla"));
    expect(rejection(db, "DELETE FROM areas WHERE slug = 'kazla'")).toContain("FOREIGN KEY");
    db.raw.exec("DELETE FROM areas WHERE slug = 'child'");
    db.raw.exec("DELETE FROM areas WHERE slug = 'kazla'");
    expect(db.raw.prepare("SELECT count(*) AS n FROM area_aliases WHERE area_id NOT IN (SELECT id FROM areas)").get()).toMatchObject({ n: 0 });
  });
});

describe("listing constraints", () => {
  function withOwner(): TestDatabase {
    const db = createTestDatabase();
    insertUser(db, "u1");
    return db;
  }

  it("requires a real owner and rejects unknown statuses and property types", () => {
    const db = withOwner();
    expect(rejection(db, INSERT_LISTING, "l1", "ghost", "s1", "mess")).toContain("FOREIGN KEY");
    expect(rejection(db, INSERT_LISTING, "l1", "u1", "s1", "castle")).toContain("CHECK");
    expect(rejection(db, "INSERT INTO listings (id, owner_id, slug, property_type, status) VALUES ('l2', 'u1', 's2', 'mess', 'removed')")).toContain("CHECK");
  });

  it("rejects a nonexistent area, sub-area or city reference", () => {
    const db = withOwner();
    expect(rejection(db, "INSERT INTO listings (id, owner_id, slug, property_type, area_id) VALUES ('l1', 'u1', 's1', 'mess', 99999)")).toContain("FOREIGN KEY");
    expect(rejection(db, "INSERT INTO listings (id, owner_id, slug, property_type, sub_area_id) VALUES ('l1', 'u1', 's1', 'mess', 99999)")).toContain("FOREIGN KEY");
    expect(rejection(db, "INSERT INTO listings (id, owner_id, slug, property_type, city_id) VALUES ('l1', 'u1', 's1', 'mess', 99999)")).toContain("FOREIGN KEY");
  });

  it("keeps slugs unique, money non-negative and incomplete listings in draft", () => {
    const db = withOwner();
    db.raw.prepare(INSERT_LISTING).run("l1", "u1", "same-slug", "mess");
    expect(rejection(db, INSERT_LISTING, "l2", "u1", "same-slug", "room")).toContain("UNIQUE");
    expect(rejection(db, "UPDATE listings SET rent_amount = -1 WHERE id = 'l1'")).toContain("CHECK");
    expect(rejection(db, "UPDATE listings SET status = 'published' WHERE id = 'l1'")).toContain("CHECK");
  });

  it("accepts every audience of the extended list and rejects unknown ones", () => {
    const db = withOwner();
    db.raw.prepare(INSERT_LISTING).run("l1", "u1", "s1", "mess");
    for (const audience of ["student", "bachelor", "family", "male", "female", "mixed", "anyone"]) {
      expect(rejection(db, "INSERT INTO listing_audiences (listing_id, audience) VALUES ('l1', ?)", audience)).toBe("");
    }
    expect(rejection(db, "INSERT INTO listing_audiences (listing_id, audience) VALUES ('l1', 'aliens')")).toContain("CHECK");
  });

  it("removes facility and audience links with the listing but protects users who still own listings", () => {
    const db = withOwner();
    db.raw.prepare(INSERT_LISTING).run("l1", "u1", "s1", "mess");
    db.raw.exec("INSERT INTO listing_facilities (listing_id, facility_id) VALUES ('l1', 1)");
    expect(rejection(db, 'DELETE FROM "user" WHERE id = ?', "u1")).toContain("FOREIGN KEY");
    db.raw.exec("DELETE FROM listings WHERE id = 'l1'");
    expect(db.raw.prepare("SELECT count(*) AS n FROM listing_facilities").get()).toMatchObject({ n: 0 });
  });
});

describe("profiles", () => {
  it("allow one profile per user and clear the preferred city if the city is removed", () => {
    const db = createTestDatabase();
    insertUser(db, "u1");
    db.raw.prepare("INSERT INTO profiles (user_id, display_name) VALUES ('u1', 'U')").run();
    expect(rejection(db, "INSERT INTO profiles (user_id, display_name) VALUES ('u1', 'Again')")).toContain("UNIQUE");
    db.raw.exec("INSERT INTO cities (district_id, name, slug) VALUES (1, 'Temp', 'temp')");
    const temp = (db.raw.prepare("SELECT id FROM cities WHERE slug = 'temp'").get() as { id: number }).id;
    db.raw.prepare("UPDATE profiles SET preferred_city_id = ? WHERE user_id = 'u1'").run(temp);
    db.raw.prepare("DELETE FROM cities WHERE id = ?").run(temp);
    expect(db.raw.prepare("SELECT preferred_city_id FROM profiles WHERE user_id = 'u1'").get()).toMatchObject({ preferred_city_id: null });
  });
});
