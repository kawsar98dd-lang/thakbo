import { redirect, type RouterContextProvider } from "react-router";
import type { AdminRole } from "~/lib/constants";
import { PATHS, pageFromRequestUrl } from "~/lib/routes";
import { getAuth } from "./auth.server";
import { currentUserContext, type SessionUser } from "./context.server";
import { getAdminRole } from "./db/repositories/admin";
import type { AppEnv } from "./env.server";
import { forbidden } from "./errors.server";
import { logger } from "./logger.server";

/** Reads the session cookie through Better Auth. Never trusts any client-provided user id. */
export async function loadSessionUser(request: Request, env: AppEnv): Promise<SessionUser | null> {
  // Anonymous visitors (and crawlers) have no session cookie: skip the database entirely.
  if (!request.headers.get("cookie")?.includes("session_token")) return null;
  try {
    const session = await getAuth(env).api.getSession({ headers: request.headers });
    if (!session) return null;
    return { id: session.user.id, name: session.user.name, email: session.user.email };
  } catch (error) {
    // Example: database not migrated yet. Public pages must still render.
    logger.warn("session lookup failed", { error });
    return null;
  }
}

/**
 * Use at the top of every loader/action that needs a signed-in user (do not rely on layout middleware alone:
 * actions can be called directly). Redirects to /login and returns the user otherwise.
 */
export function requireUser(context: Readonly<RouterContextProvider>, request: Request): SessionUser {
  const user = context.get(currentUserContext);
  if (!user) {
    throw redirect(`${PATHS.login}?redirectTo=${encodeURIComponent(pageFromRequestUrl(request.url))}`);
  }
  return user;
}

/** Signed in AND listed in admin_users. Otherwise throws 403 (or redirects to /login). */
export async function requireAdmin(
  context: Readonly<RouterContextProvider>,
  request: Request,
  db: D1Database,
): Promise<{ user: SessionUser; role: AdminRole }> {
  const user = requireUser(context, request);
  const role = await getAdminRole(db, user.id);
  if (!role) throw forbidden();
  return { user, role };
}
