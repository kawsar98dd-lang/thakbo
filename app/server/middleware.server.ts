import type { MiddlewareFunction } from "react-router";
import { adminRoleContext, cloudflareContext, currentUserContext } from "./context.server";
import { forbidden } from "./errors.server";
import { loadSessionUser, requireAdmin, requireUser } from "./session.server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Defence-in-depth against cross-site form posts: state-changing requests that carry an
 * Origin header must come from this site. (Cookies are also SameSite=Lax via Better Auth.)
 */
export const originCheckMiddleware: MiddlewareFunction<Response> = ({ request }, next) => {
  if (!SAFE_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw forbidden();
  }
  return next();
};

/** Makes the signed-in user (or null) available to every route through context. */
export const sessionMiddleware: MiddlewareFunction<Response> = async ({ request, context }, next) => {
  const { env } = context.get(cloudflareContext);
  context.set(currentUserContext, await loadSessionUser(request, env));
  return next();
};

/** Layout guard for /dashboard/*. Actions must still call requireUser() themselves. */
export const requireUserMiddleware: MiddlewareFunction<Response> = ({ request, context }, next) => {
  requireUser(context, request);
  return next();
};

/** Layout guard for /admin/*: verifies the admin_users role in D1 on the server. */
export const requireAdminMiddleware: MiddlewareFunction<Response> = async ({ request, context }, next) => {
  const { env } = context.get(cloudflareContext);
  const { role } = await requireAdmin(context, request, env.DB);
  context.set(adminRoleContext, role);
  return next();
};
