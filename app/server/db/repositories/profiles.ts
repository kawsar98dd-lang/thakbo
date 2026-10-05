import { execute, queryFirst } from "../client";

export interface Profile {
  userId: string;
  displayName: string;
  phone: string | null;
  whatsapp: string | null;
  bio: string | null;
  avatarUrl: string | null;
  preferredCityId: number | null;
}

/** The only fields a user may change on their own profile (everything else, e.g. avatar, is never mass-assigned). */
export interface ProfileUpdate {
  displayName: string;
  phone: string | null;
  whatsapp: string | null;
  bio: string | null;
  preferredCityId: number | null;
}

/** Creates the profile row for a new account. Safe to call repeatedly; never overwrites an existing profile. */
export async function ensureProfile(db: D1Database, userId: string, displayName: string): Promise<void> {
  await execute(db, "INSERT OR IGNORE INTO profiles (user_id, display_name) VALUES (?, ?)", [userId, displayName]);
}

export function getProfile(db: D1Database, userId: string): Promise<Profile | null> {
  return queryFirst<Profile>(
    db,
    `SELECT user_id AS userId, display_name AS displayName, phone, whatsapp, bio, avatar_url AS avatarUrl,
            preferred_city_id AS preferredCityId
     FROM profiles WHERE user_id = ?`,
    [userId],
  );
}

/** Updates ONLY the row of `userId` (taken from the verified session by the caller). Returns false when no profile exists. */
export async function updateProfile(db: D1Database, userId: string, update: ProfileUpdate): Promise<boolean> {
  const result = await execute(
    db,
    `UPDATE profiles
     SET display_name = ?, phone = ?, whatsapp = ?, bio = ?, preferred_city_id = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE user_id = ?`,
    [update.displayName, update.phone, update.whatsapp, update.bio, update.preferredCityId, userId],
  );
  return result.meta.changes > 0;
}
