import { queryAll } from "../client";

export interface Facility {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
}

export function listActiveFacilities(db: D1Database): Promise<Facility[]> {
  return queryAll<Facility>(
    db,
    "SELECT id, name, slug, icon FROM facilities WHERE is_active = 1 ORDER BY sort_order, name",
  );
}
