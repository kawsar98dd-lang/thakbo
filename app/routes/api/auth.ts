import type { Route } from "./+types/auth";
import { getAuth } from "~/server/auth.server";
import { cloudflareContext } from "~/server/context.server";

/** All Better Auth endpoints live under /api/auth/* (sign-in, sign-up, sign-out, session, ...). */
export function loader({ request, context }: Route.LoaderArgs) {
  return getAuth(context.get(cloudflareContext).env).handler(request);
}

export function action({ request, context }: Route.ActionArgs) {
  return getAuth(context.get(cloudflareContext).env).handler(request);
}
