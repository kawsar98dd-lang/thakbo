import { ADMIN_ROLES, type AdminRole } from "~/lib/constants";
import { queryFirst } from "../client";

/** Admin access is granted ONLY by a row in admin_users. Returns null for ordinary users. */
export async function getAdminRole(db: D1Database, userId: string): Promise<AdminRole | null> {
  const row = await queryFirst<{ role: string }>(db, "SELECT role FROM admin_users WHERE user_id = ?", [userId]);
  const role = row?.role;
  return ADMIN_ROLES.find((allowed) => allowed === role) ?? null;
}
