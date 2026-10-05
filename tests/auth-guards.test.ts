import { RouterContextProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { currentUserContext } from "~/server/context.server";
import { requireAdmin, requireUser } from "~/server/session.server";
import { createTestDatabase, insertUser } from "./helpers/sqlite-d1";

function contextFor(user: { id: string; name: string; email: string } | null): RouterContextProvider {
  const context = new RouterContextProvider();
  if (user) context.set(currentUserContext, user);
  return context;
}

function capture(action: () => unknown): unknown {
  try {
    action();
  } catch (thrown) {
    return thrown;
  }
  return undefined;
}

async function captureAsync(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
  } catch (thrown) {
    return thrown;
  }
  return undefined;
}

const request = (path: string) => new Request(`https://thakbo.test${path}`);

describe("requireUser (protects /dashboard and listing management)", () => {
  it("redirects anonymous visitors to the login page and remembers where they wanted to go", () => {
    const thrown = capture(() => requireUser(contextFor(null), request("/dashboard/listings/new")));
    expect(thrown instanceof Response).toBe(true);
    const response = thrown as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?redirectTo=%2Fdashboard%2Flistings%2Fnew");
  });

  it("does not leak React Router's internal data-request URL into the redirect target", () => {
    const thrown = capture(() => requireUser(contextFor(null), request("/dashboard/profile.data?_routes=routes%2Fdashboard")));
    expect((thrown as Response).headers.get("location")).toBe("/login?redirectTo=%2Fdashboard%2Fprofile");
  });

  it("returns the signed-in user", () => {
    const user = { id: "u1", name: "Rahim", email: "r@example.test" };
    expect(requireUser(contextFor(user), request("/dashboard"))).toEqual(user);
  });
});

describe("requireAdmin", () => {
  it("rejects a signed-in user who is not in admin_users with a 403", async () => {
    const db = createTestDatabase();
    insertUser(db, "u1");
    const thrown = await captureAsync(() => requireAdmin(contextFor({ id: "u1", name: "U", email: "u@x.test" }), request("/admin"), db.d1));
    expect(thrown).toMatchObject({ init: { status: 403 } });
  });

  it("sends anonymous visitors to the login page", async () => {
    const db = createTestDatabase();
    const thrown = await captureAsync(() => requireAdmin(contextFor(null), request("/admin"), db.d1));
    expect((thrown as Response).status).toBe(302);
  });

  it("accepts users listed in admin_users, and the role comes from the database only", async () => {
    const db = createTestDatabase();
    insertUser(db, "boss");
    db.raw.prepare("INSERT INTO admin_users (user_id, role) VALUES ('boss', 'moderator')").run();
    const result = await requireAdmin(contextFor({ id: "boss", name: "B", email: "b@x.test" }), request("/admin"), db.d1);
    expect(result.role).toBe("moderator");
  });
});
