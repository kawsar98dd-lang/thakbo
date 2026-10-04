import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { PATHS } from "~/lib/routes";
import { signOutUser } from "~/server/auth-actions.server";
import { cloudflareContext } from "~/server/context.server";

/** Visiting /logout in the browser does nothing harmful; only a POST (the Log out button) ends the session. */
export function loader() {
  return redirect(PATHS.home);
}

export async function action({ request, context }: Route.ActionArgs) {
  const headers = await signOutUser(context.get(cloudflareContext).env, request);
  return redirect(PATHS.home, { headers });
}
