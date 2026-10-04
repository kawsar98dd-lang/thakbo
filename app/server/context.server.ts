import { createContext } from "react-router";
import type { AdminRole } from "~/lib/constants";
import type { AppEnv } from "./env.server";

/** Set once per request in workers/app.ts. */
export const cloudflareContext = createContext<{ env: AppEnv; ctx: ExecutionContext }>();

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

/** Set by the root session middleware. `null` means "not signed in". */
export const currentUserContext = createContext<SessionUser | null>(null);

/** Set by the admin layout middleware after the role was verified in the database. */
export const adminRoleContext = createContext<AdminRole | null>(null);
