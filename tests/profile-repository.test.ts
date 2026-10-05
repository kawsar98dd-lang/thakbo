import { describe, expect, it } from "vitest";
import { ensureProfile, getProfile, updateProfile } from "~/server/db/repositories/profiles";
import { createTestDatabase, insertUser, seededCityId } from "./helpers/sqlite-d1";

const update = (displayName: string) => ({ displayName, phone: "01712345678", whatsapp: null, bio: "Hello", preferredCityId: null });

describe("profile repository", () => {
  it("creates a profile once and never overwrites an existing one", async () => {
    const db = createTestDatabase();
    insertUser(db, "u1", "Original");
    await ensureProfile(db.d1, "u1", "Original");
    await updateProfile(db.d1, "u1", update("Edited Name"));
    await ensureProfile(db.d1, "u1", "Original");
    expect((await getProfile(db.d1, "u1"))?.displayName).toBe("Edited Name");
  });

  it("updates only the profile of the given (session) user", async () => {
    const db = createTestDatabase();
    for (const id of ["alice", "bob"]) {
      insertUser(db, id);
      await ensureProfile(db.d1, id, id);
    }
    expect(await updateProfile(db.d1, "alice", update("Alice Updated"))).toBe(true);
    expect((await getProfile(db.d1, "alice"))?.displayName).toBe("Alice Updated");
    expect(await getProfile(db.d1, "bob")).toMatchObject({ displayName: "bob", phone: null, bio: null });
  });

  it("returns false when the user has no profile (nothing is created by accident)", async () => {
    const db = createTestDatabase();
    expect(await updateProfile(db.d1, "ghost", update("Ghost"))).toBe(false);
    expect(await getProfile(db.d1, "ghost")).toBeNull();
  });

  it("never touches the avatar and stores the preferred city", async () => {
    const db = createTestDatabase();
    insertUser(db, "u1");
    await ensureProfile(db.d1, "u1", "U One");
    db.raw.prepare("UPDATE profiles SET avatar_url = ? WHERE user_id = ?").run("avatars/u1.png", "u1");
    const cityId = seededCityId(db);
    await updateProfile(db.d1, "u1", { ...update("U One"), preferredCityId: cityId });
    expect(await getProfile(db.d1, "u1")).toMatchObject({ avatarUrl: "avatars/u1.png", preferredCityId: cityId });
  });

  it("refuses a preferred city that does not exist (foreign key)", async () => {
    const db = createTestDatabase();
    insertUser(db, "u1");
    await ensureProfile(db.d1, "u1", "U One");
    let failed = false;
    try {
      await updateProfile(db.d1, "u1", { ...update("U One"), preferredCityId: 987654 });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});
