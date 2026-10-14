import { describe, expect, it } from "vitest";
import { getAdminRole } from "~/server/db/repositories/admin";
import { createTestDatabase, insertUser } from "./helpers/sqlite-d1";

describe("server-side admin role access", () => {
  it("does not grant admin access to an ordinary signed-in user", async () => {
    const db = createTestDatabase();
    insertUser(db, "ordinary-user");

    await expect(getAdminRole(db.d1, "ordinary-user")).resolves.toBeNull();
  });

  it.each(["admin", "moderator"] as const)("recognizes the explicitly assigned %s role", async (role) => {
    const db = createTestDatabase();
    insertUser(db, `${role}-user`);
    db.raw.prepare("INSERT INTO admin_users (user_id, role) VALUES (?, ?)").run(`${role}-user`, role);

    await expect(getAdminRole(db.d1, `${role}-user`)).resolves.toBe(role);
  });

  it("reflects a role revocation on the next permission lookup", async () => {
    const db = createTestDatabase();
    insertUser(db, "revoked-admin");
    db.raw.prepare("INSERT INTO admin_users (user_id, role) VALUES (?, 'admin')").run("revoked-admin");

    await expect(getAdminRole(db.d1, "revoked-admin")).resolves.toBe("admin");
    db.raw.prepare("DELETE FROM admin_users WHERE user_id = ?").run("revoked-admin");
    await expect(getAdminRole(db.d1, "revoked-admin")).resolves.toBeNull();
  });

  it("does not accept a role for a different user id", async () => {
    const db = createTestDatabase();
    insertUser(db, "listed-admin");
    insertUser(db, "other-user");
    db.raw.prepare("INSERT INTO admin_users (user_id, role) VALUES (?, 'admin')").run("listed-admin");

    await expect(getAdminRole(db.d1, "other-user")).resolves.toBeNull();
  });
});
