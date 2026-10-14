import type { ReportStatus } from "~/lib/constants";
import { execute, queryAll, queryFirst } from "../client";

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export async function getAdminOverview(db: D1Database) {
  const row = await queryFirst<{ users: number; published: number; pending: number; totalListings: number; pendingReports: number }>(db,
    `SELECT
      (SELECT COUNT(*) FROM "user") AS users,
      (SELECT COUNT(*) FROM listings WHERE status = 'published') AS published,
      (SELECT COUNT(*) FROM listings WHERE status = 'pending') AS pending,
      (SELECT COUNT(*) FROM listings WHERE status NOT IN ('deleted')) AS totalListings,
      (SELECT COUNT(*) FROM reports WHERE status = 'pending') AS pendingReports`);
  return row ?? { users: 0, published: 0, pending: 0, totalListings: 0, pendingReports: 0 };
}

export interface AdminUserRow { id: string; name: string; email: string; createdAt: string; displayName: string | null; role: string | null }

/** Search and paginate account records for admins; all user input is bound as SQL parameters. */
export async function listAdminUsersPage(
  db: D1Database,
  options: { query?: string; page?: number; pageSize?: number } = {},
): Promise<{ users: AdminUserRow[]; total: number; page: number; pageSize: number }> {
  const pageSize = boundedInteger(options.pageSize, 25, 1, 50);
  const page = boundedInteger(options.page, 1, 1, 10000);
  // Treat %, _ and \ literally so the search input cannot accidentally become a wildcard query.
  const rawQuery = (options.query ?? "").trim().slice(0, 100);
  const escapedQuery = rawQuery.replace(/[\\%_]/g, "\\$&");
  const where = rawQuery ? `WHERE (u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR COALESCE(p.display_name, '') LIKE ? ESCAPE '\\')` : "";
  const search = `%${escapedQuery}%`;
  const params = rawQuery ? [search, search, search] : [];
  const totalRow = await queryFirst<{ total: number }>(db,
    `SELECT COUNT(*) AS total FROM "user" u LEFT JOIN profiles p ON p.user_id = u.id ${where}`, params);
  const users = await queryAll<AdminUserRow>(db,
    `SELECT u.id, u.name, u.email, u."createdAt" AS createdAt, p.display_name AS displayName, au.role
     FROM "user" u LEFT JOIN profiles p ON p.user_id = u.id LEFT JOIN admin_users au ON au.user_id = u.id
     ${where} ORDER BY u."createdAt" DESC, u.id LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
  return { users, total: totalRow?.total ?? 0, page, pageSize };
}

/** Compatibility helper for repository consumers that only need the latest account rows. */
export async function listAdminUsers(db: D1Database): Promise<AdminUserRow[]> {
  return (await listAdminUsersPage(db, { page: 1, pageSize: 50 })).users;
}

export interface AdminReportRow {
  id: string; listingId: string; listingTitle: string | null; listingSlug: string | null; reason: string; details: string | null;
  status: ReportStatus; adminNote: string | null; createdAt: string; reporterName: string | null; reporterEmail: string | null;
}
export interface AdminReportsPage {
  reports: AdminReportRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Paginated report queue; prevents older reports from silently disappearing beyond a hard 200-row cap. */
export async function listAdminReportsPage(
  db: D1Database,
  status: ReportStatus | "all" = "pending",
  options: { page?: number; pageSize?: number } = {},
): Promise<AdminReportsPage> {
  const pageSize = boundedInteger(options.pageSize, 25, 1, 50);
  const requestedPage = boundedInteger(options.page, 1, 1, 10000);
  const where = status === "all" ? "" : "WHERE status = ?";
  const params = status === "all" ? [] : [status];
  const count = await queryFirst<{ total: number }>(db, `SELECT COUNT(*) AS total FROM reports ${where}`, params);
  const total = count?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const reports = await queryAll<AdminReportRow>(db,
    `SELECT r.id, r.listing_id AS listingId, l.title AS listingTitle, l.slug AS listingSlug,
            r.reason, r.details, r.status, r.admin_note AS adminNote, r.created_at AS createdAt,
            u.name AS reporterName, u.email AS reporterEmail
     FROM reports r LEFT JOIN listings l ON l.id = r.listing_id LEFT JOIN "user" u ON u.id = r.reporter_id
     ${status === "all" ? "" : "WHERE r.status = ?"}
     ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at ASC, r.id ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]);
  return { reports, total, page, pageSize };
}

/** Compatibility helper preserves the old maximum of 200 rows for older internal callers. */
export async function listAdminReports(db: D1Database, status: ReportStatus | "all" = "pending"): Promise<AdminReportRow[]> {
  const first = await listAdminReportsPage(db, status, { page: 1, pageSize: 50 });
  const reports = [...first.reports];
  const pages = Math.min(4, Math.ceil(first.total / first.pageSize));
  for (let page = 2; page <= pages; page += 1) {
    reports.push(...(await listAdminReportsPage(db, status, { page, pageSize: 50 })).reports);
  }
  return reports;
}

export async function updateAdminReport(db: D1Database, id: string, status: ReportStatus, adminNote: string | null): Promise<boolean> {
  const result = await execute(db,
    `UPDATE reports SET status = ?, admin_note = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    [status, adminNote, id]);
  return result.meta.changes > 0;
}

export interface AdminCityRow {
  id: number;
  name: string;
  nameEn: string | null;
  nameBn: string | null;
  slug: string;
  isActive: number;
  districtName: string;
  districtActive: number;
  divisionName: string;
  divisionActive: number;
  countryActive: number;
  areaCount: number;
}
export interface AdminCitiesPage { cities: AdminCityRow[]; total: number; page: number; pageSize: number }

/** Search and paginate cities for multi-city administration. Names/slugs are searched literally. */
export async function listAdminCitiesPage(
  db: D1Database,
  options: { query?: string; page?: number; pageSize?: number } = {},
): Promise<AdminCitiesPage> {
  const pageSize = boundedInteger(options.pageSize, 25, 1, 50);
  const requestedPage = boundedInteger(options.page, 1, 1, 10000);
  const rawQuery = (options.query ?? "").trim().slice(0, 100);
  const escapedQuery = rawQuery.replace(/[\\%_]/g, "\\$&");
  const where = rawQuery
    ? `WHERE (c.name LIKE ? ESCAPE '\\' OR COALESCE(c.name_en, '') LIKE ? ESCAPE '\\' OR COALESCE(c.name_bn, '') LIKE ? ESCAPE '\\' OR c.slug LIKE ? ESCAPE '\\' OR d.name LIKE ? ESCAPE '\\' OR dv.name LIKE ? ESCAPE '\\')`
    : "";
  const search = `%${escapedQuery}%`;
  const params = rawQuery ? [search, search, search, search, search, search] : [];
  const count = await queryFirst<{ total: number }>(db,
    `SELECT COUNT(*) AS total FROM cities c JOIN districts d ON d.id = c.district_id JOIN divisions dv ON dv.id = d.division_id JOIN countries co ON co.id = dv.country_id ${where}`, params);
  const total = count?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const cities = await queryAll<AdminCityRow>(db,
    `SELECT c.id, c.name, c.name_en AS nameEn, c.name_bn AS nameBn, c.slug, c.is_active AS isActive,
            d.name AS districtName, d.is_active AS districtActive, dv.name AS divisionName, dv.is_active AS divisionActive, co.is_active AS countryActive,
            (SELECT COUNT(*) FROM areas a WHERE a.city_id = c.id) AS areaCount
     FROM cities c JOIN districts d ON d.id = c.district_id JOIN divisions dv ON dv.id = d.division_id JOIN countries co ON co.id = dv.country_id ${where}
     ORDER BY c.name, c.id LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
  return { cities, total, page, pageSize };
}

/** A city can only be re-enabled when every administrative ancestor is active. Disabling is non-destructive. */
export async function updateAdminCityStatus(db: D1Database, cityId: number, isActive: boolean): Promise<boolean> {
  const sql = isActive
    ? `UPDATE cities SET is_active = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND EXISTS (
         SELECT 1 FROM districts d
         JOIN divisions dv ON dv.id = d.division_id AND dv.is_active = 1
         JOIN countries co ON co.id = dv.country_id AND co.is_active = 1
         WHERE d.id = cities.district_id AND d.is_active = 1
       )`
    : `UPDATE cities SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`;
  const result = await execute(db, sql, [cityId]);
  return result.meta.changes > 0;
}

export interface AdminLocationRow { areaId: number; cityId: number; cityName: string; citySlug: string; cityActive: number; areaName: string; areaSlug: string; areaActive: number; parentAreaId: number | null }
export interface AdminLocationsPage { locations: AdminLocationRow[]; total: number; page: number; pageSize: number }

/** Search and paginate the location catalogue so later cities/areas are not hidden by a fixed row cap. */
export async function listAdminLocationsPage(
  db: D1Database,
  options: { query?: string; page?: number; pageSize?: number } = {},
): Promise<AdminLocationsPage> {
  const pageSize = boundedInteger(options.pageSize, 25, 1, 50);
  const requestedPage = boundedInteger(options.page, 1, 1, 10000);
  const rawQuery = (options.query ?? "").trim().slice(0, 100);
  const escapedQuery = rawQuery.replace(/[\\%_]/g, "\\$&");
  const where = rawQuery
    ? `WHERE (a.name LIKE ? ESCAPE '\\' OR a.slug LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR c.slug LIKE ? ESCAPE '\\')`
    : "";
  const search = `%${escapedQuery}%`;
  const params = rawQuery ? [search, search, search, search] : [];
  const count = await queryFirst<{ total: number }>(db,
    `SELECT COUNT(*) AS total FROM areas a JOIN cities c ON c.id = a.city_id ${where}`, params);
  const total = count?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const locations = await queryAll<AdminLocationRow>(db,
    `SELECT a.id AS areaId, c.id AS cityId, c.name AS cityName, c.slug AS citySlug, c.is_active AS cityActive,
            a.name AS areaName, a.slug AS areaSlug, a.is_active AS areaActive, a.parent_area_id AS parentAreaId
     FROM areas a JOIN cities c ON c.id = a.city_id ${where}
     ORDER BY c.name, a.search_priority DESC, a.name, a.id LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]);
  return { locations, total, page, pageSize };
}

/** Compatibility helper for older internal callers that only need the first location rows. */
export async function listAdminLocations(db: D1Database): Promise<AdminLocationRow[]> {
  return (await listAdminLocationsPage(db, { page: 1, pageSize: 50 })).locations;
}

export interface AdminFacilityRow { id: number; name: string; slug: string; icon: string | null; isActive: number; sortOrder: number }
export function listAdminFacilities(db: D1Database): Promise<AdminFacilityRow[]> {
  return queryAll<AdminFacilityRow>(db,
    "SELECT id, name, slug, icon, is_active AS isActive, sort_order AS sortOrder FROM facilities ORDER BY sort_order, name LIMIT 300");
}

/** Enables/disables a catalogue item without deleting it or breaking existing listing references. */
export async function updateAdminFacilityStatus(db: D1Database, id: number, isActive: boolean): Promise<boolean> {
  const result = await execute(db,
    "UPDATE facilities SET is_active = ? WHERE id = ?",
    [isActive ? 1 : 0, id]);
  return result.meta.changes > 0;
}


/**
 * Toggle a location area without deleting it or changing its public slug. Re-enabling is
 * permitted only when its city and administrative ancestors are active; sub-areas also
 * require an active parent. Disabling remains possible even if an ancestor is already off.
 */
export async function updateAdminAreaStatus(db: D1Database, areaId: number, isActive: boolean): Promise<boolean> {
  const sql = isActive
    ? `UPDATE areas SET is_active = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND EXISTS (
         SELECT 1 FROM cities c
         JOIN districts d ON d.id = c.district_id AND d.is_active = 1
         JOIN divisions dv ON dv.id = d.division_id AND dv.is_active = 1
         JOIN countries co ON co.id = dv.country_id AND co.is_active = 1
         WHERE c.id = areas.city_id AND c.is_active = 1
           AND (areas.parent_area_id IS NULL OR EXISTS (
             SELECT 1 FROM areas p WHERE p.id = areas.parent_area_id
               AND p.city_id = areas.city_id AND p.is_active = 1
           ))
       )`
    : `UPDATE areas SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`;
  const result = await execute(db, sql, [areaId]);
  return result.meta.changes > 0;
}
