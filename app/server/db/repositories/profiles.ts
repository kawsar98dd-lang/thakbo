import { execute, queryFirst } from "../client";

export interface Profile {
  userId: string;
  displayName: string;
  phone: string | null;
  whatsapp: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

/** Creates the profile row for a new account. Safe to call repeatedly. */
export async function ensureProfile(db: D1Database, userId: string, displayName: string): Promise<void> {
  await execute(db, "INSERT OR IGNORE INTO profiles (user_id, display_name) VALUES (?, ?)", [userId, displayName]);
}

export function getProfile(db: D1Database, userId: string): Promise<Profile | null> {
  return queryFirst<Profile>(
    db,
    `SELECT user_id AS userId, display_name AS displayName, phone, whatsapp, bio, avatar_url AS avatarUrl
     FROM profiles WHERE user_id = ?`,
    [userId],
  );
}
