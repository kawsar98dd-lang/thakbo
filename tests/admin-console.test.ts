import { describe, expect, it } from "vitest";
import { getAdminOverview, listAdminCitiesPage, listAdminFacilities, listAdminLocations, listAdminLocationsPage, listAdminReportsPage, listAdminUsers, listAdminUsersPage, updateAdminAreaStatus, updateAdminCityStatus, updateAdminFacilityStatus } from "~/server/db/repositories/admin-console";
import { createTestDatabase, insertUser, seededAreaId, seededCityId } from "./helpers/sqlite-d1";
import { createDraftListing } from "~/server/db/repositories/listings";
import { draftData, walkToStatus } from "./helpers/listings";

describe("admin console repository", () => {
  it("lists users using Better Auth's camelCase createdAt column in newest-first order", async () => {
    const db = createTestDatabase();
    insertUser(db, "older", "Older User");
    insertUser(db, "newer", "Newer User");
    db.raw.prepare('UPDATE "user" SET "createdAt" = ? WHERE id = ?').run("2026-01-01T00:00:00.000Z", "older");
    db.raw.prepare('UPDATE "user" SET "createdAt" = ? WHERE id = ?').run("2026-02-01T00:00:00.000Z", "newer");

    const users = await listAdminUsers(db.d1);
    expect(users.slice(0, 2).map((user) => user.id)).toEqual(["newer", "older"]);
    expect(users[0]).toMatchObject({ id: "newer", name: "Newer User", email: "newer@example.test" });
  });


  it("searches admin users by name or email and paginates results", async () => {
    const db = createTestDatabase();
    insertUser(db, "alice", "Alice Raj");
    insertUser(db, "bob", "Bob Rahman");
    insertUser(db, "charlie", "Charlie Ahmed");
    const first = await listAdminUsersPage(db.d1, { page: 1, pageSize: 2 });
    const second = await listAdminUsersPage(db.d1, { page: 2, pageSize: 2 });
    expect(first.total).toBe(3);
    expect(first.users).toHaveLength(2);
    expect(second.users).toHaveLength(1);
    expect(new Set([...first.users, ...second.users].map((user) => user.id)).size).toBe(3);
    expect((await listAdminUsersPage(db.d1, { query: "BOB" })).users.map((user) => user.id)).toContain("bob");
  });

  it("treats LIKE wildcards as literal search text", async () => {
    const db = createTestDatabase();
    insertUser(db, "percent-user", "Percent User");
    insertUser(db, "normal-user", "Normal User");
    const result = await listAdminUsersPage(db.d1, { query: "%" });
    expect(result.users).toEqual([]);
  });

  it("returns zero-safe overview counts for a fresh database", async () => {
    const db = createTestDatabase();
    expect(await getAdminOverview(db.d1)).toEqual({ users: 0, published: 0, pending: 0, totalListings: 0, pendingReports: 0 });
  });
});


describe("admin facility catalogue controls", () => {
  it("can hide and re-enable a facility without deleting it", async () => {
    const db = createTestDatabase();
    const before = await listAdminFacilities(db.d1);
    expect(before.length).toBeGreaterThan(0);
    const facility = before[0];

    expect(await updateAdminFacilityStatus(db.d1, facility.id, false)).toBe(true);
    expect((await listAdminFacilities(db.d1)).find((item) => item.id === facility.id)?.isActive).toBe(0);
    expect(await updateAdminFacilityStatus(db.d1, facility.id, true)).toBe(true);
    expect((await listAdminFacilities(db.d1)).find((item) => item.id === facility.id)?.isActive).toBe(1);
    expect(db.raw.prepare("SELECT COUNT(*) AS count FROM facilities WHERE id = ?").get(facility.id)).toMatchObject({ count: 1 });
  });

  it("reports a missing facility instead of claiming an update", async () => {
    const db = createTestDatabase();
    expect(await updateAdminFacilityStatus(db.d1, 999999, false)).toBe(false);
  });
});


describe("admin location catalogue pagination", () => {
  it("searches area and city names, paginates, and clamps stale pages", async () => {
    const db = createTestDatabase();
    const initial = await listAdminLocationsPage(db.d1, { page: 1, pageSize: 2 });
    expect(initial.total).toBeGreaterThan(2);
    expect(initial.locations).toHaveLength(2);
    const second = await listAdminLocationsPage(db.d1, { page: 2, pageSize: 2 });
    expect(second.locations).toHaveLength(2);
    expect(new Set([...initial.locations, ...second.locations].map((row) => row.areaId)).size).toBe(4);
    const search = await listAdminLocationsPage(db.d1, { query: "RAJSHAHI" });
    expect(search.total).toBeGreaterThan(0);
    expect(search.locations.every((row) => row.cityName.toLowerCase().includes("rajshahi"))).toBe(true);
    const wildcard = await listAdminLocationsPage(db.d1, { query: "%" });
    expect(wildcard.total).toBe(0);
    const last = await listAdminLocationsPage(db.d1, { page: 999, pageSize: 2 });
    expect(last.page).toBe(Math.ceil(last.total / 2));
  });
});

describe("admin location catalogue controls", () => {
  it("can hide and re-enable an area without deleting or renaming it", async () => {
    const db = createTestDatabase();
    const before = await listAdminLocations(db.d1);
    expect(before.length).toBeGreaterThan(0);
    const area = before.find((item) => item.parentAreaId === null && item.areaActive === 1 && item.cityActive === 1);
    expect(area).toBeDefined();
    if (!area) return;

    expect(await updateAdminAreaStatus(db.d1, area.areaId, false)).toBe(true);
    expect((await listAdminLocations(db.d1)).find((item) => item.areaId === area.areaId)?.areaActive).toBe(0);
    expect(await updateAdminAreaStatus(db.d1, area.areaId, true)).toBe(true);
    const restored = (await listAdminLocations(db.d1)).find((item) => item.areaId === area.areaId);
    expect(restored).toMatchObject({ areaActive: 1, areaSlug: area.areaSlug, areaName: area.areaName });
  });

  it("does not enable a child area when its parent is inactive", async () => {
    const db = createTestDatabase();
    const rows = await listAdminLocations(db.d1);
    const parent = rows.find((item) => item.parentAreaId === null && item.areaActive === 1);
    expect(parent).toBeDefined();
    if (!parent) return;
    const inserted = db.raw.prepare(
      "INSERT INTO areas (city_id, name, slug, is_active, parent_area_id) VALUES (?, ?, ?, 0, ?)"
    ).run(parent.cityId, "Test sub-area", `test-sub-area-${parent.areaId}`, parent.areaId);
    const childId = Number(inserted.lastInsertRowid);
    await updateAdminAreaStatus(db.d1, parent.areaId, false);
    expect(await updateAdminAreaStatus(db.d1, childId, true)).toBe(false);
  });

  it("reports an unknown area ID", async () => {
    const db = createTestDatabase();
    expect(await updateAdminAreaStatus(db.d1, 999999, false)).toBe(false);
  });
});

describe("admin report queue pagination", () => {
  it("paginates all matching reports and clamps stale page numbers", async () => {
    const db = createTestDatabase();
    insertUser(db, "report-owner");
    await createDraftListing(db.d1, "report-owner", draftData({
      title: "Reported accommodation", cityId: seededCityId(db), areaId: seededAreaId(db, "hetem-khan"),
      latitude: 24.37, longitude: 88.6,
    }), { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", slug: "reported-accommodation" });
    walkToStatus(db, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "published");

    const insertReport = db.raw.prepare("INSERT INTO reports (id, listing_id, reason, status) VALUES (?, ?, ?, ?)");
    for (let i = 1; i <= 27; i++) {
      insertReport.run(`report-${String(i).padStart(2, "0")}`, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "other", i === 27 ? "resolved" : "pending");
    }

    const first = await listAdminReportsPage(db.d1, "pending", { page: 1, pageSize: 10 });
    const second = await listAdminReportsPage(db.d1, "pending", { page: 2, pageSize: 10 });
    const last = await listAdminReportsPage(db.d1, "pending", { page: 999, pageSize: 10 });
    const all = await listAdminReportsPage(db.d1, "all", { page: 1, pageSize: 50 });

    expect(first).toMatchObject({ total: 26, page: 1, pageSize: 10 });
    expect(first.reports).toHaveLength(10);
    expect(second.reports).toHaveLength(10);
    expect(last).toMatchObject({ total: 26, page: 3 });
    expect(last.reports).toHaveLength(6);
    expect(all.total).toBe(27);
    expect(all.reports).toHaveLength(27);
  });
});



describe("admin city catalogue controls", () => {
  it("searches city, district and division, paginates, and treats wildcards literally", async () => {
    const db = createTestDatabase();
    const first = await listAdminCitiesPage(db.d1, { page: 1, pageSize: 1 });
    expect(first.total).toBeGreaterThan(0);
    expect(first.cities).toHaveLength(1);
    expect((await listAdminCitiesPage(db.d1, { query: "RAJSHAHI" })).cities.map((city) => city.slug)).toContain("rajshahi");
    expect((await listAdminCitiesPage(db.d1, { query: "%" })).total).toBe(0);
    expect((await listAdminCitiesPage(db.d1, { page: 999, pageSize: 1 })).page).toBe(first.total);
  });

  it("hides and re-enables a city without deleting its areas", async () => {
    const db = createTestDatabase();
    const city = (await listAdminCitiesPage(db.d1)).cities[0];
    expect(city).toBeDefined();
    expect(await updateAdminCityStatus(db.d1, city.id, false)).toBe(true);
    expect((await listAdminCitiesPage(db.d1)).cities.find((row) => row.id === city.id)?.isActive).toBe(0);
    expect(await updateAdminCityStatus(db.d1, city.id, true)).toBe(true);
    expect((await listAdminCitiesPage(db.d1)).cities.find((row) => row.id === city.id)).toMatchObject({ isActive: 1, slug: city.slug });
    expect(db.raw.prepare("SELECT COUNT(*) AS count FROM areas WHERE city_id = ?").get(city.id)?.count ?? 0).toBeGreaterThan(0);
  });

  it("refuses to re-enable a city whose district or ancestors are inactive", async () => {
    const db = createTestDatabase();
    const city = (await listAdminCitiesPage(db.d1)).cities[0];
    db.raw.prepare("UPDATE divisions SET is_active = 0 WHERE slug = ?").run("rajshahi");
    expect(await updateAdminCityStatus(db.d1, city.id, false)).toBe(true);
    expect(await updateAdminCityStatus(db.d1, city.id, true)).toBe(false);
    expect(await updateAdminCityStatus(db.d1, 999999, false)).toBe(false);
  });
});
