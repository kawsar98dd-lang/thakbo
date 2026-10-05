import { queryAll, queryFirst } from "../client";

export interface Facility {
  id: number;
  name: string;
  nameEn: string | null;
  nameBn: string | null;
  slug: string;
  icon: string | null;
  category: string | null;
}

const FACILITY_COLUMNS = "id, name, name_en AS nameEn, name_bn AS nameBn, slug, icon, category";

/** Active facilities in display order (the catalogue lives in the database, never in React code). */
export function listActiveFacilities(db: D1Database): Promise<Facility[]> {
  return queryAll<Facility>(
    db,
    `SELECT ${FACILITY_COLUMNS} FROM facilities WHERE is_active = 1 ORDER BY sort_order, name`,
  );
}

export function getFacilityBySlug(db: D1Database, slug: string): Promise<Facility | null> {
  return queryFirst<Facility>(db, `SELECT ${FACILITY_COLUMNS} FROM facilities WHERE slug = ? AND is_active = 1`, [slug]);
}

export function getFacilityById(db: D1Database, id: number): Promise<Facility | null> {
  return queryFirst<Facility>(db, `SELECT ${FACILITY_COLUMNS} FROM facilities WHERE id = ? AND is_active = 1`, [id]);
}

/** Keeps only ids that exist and are active (used to validate submitted facility ids). */
export async function filterActiveFacilityIds(db: D1Database, ids: readonly number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await queryAll<{ id: number }>(
    db,
    `SELECT id FROM facilities WHERE is_active = 1 AND id IN (${placeholders})`,
    ids,
  );
  return rows.map((row) => row.id);
}
