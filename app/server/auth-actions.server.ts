import type { LoginInput, RegisterInput } from "~/lib/validation/auth";
import { getAuth } from "./auth.server";
import type { AppEnv } from "./env.server";
import { logger } from "./logger.server";

export type AuthResult =
  | { ok: true; headers: Headers }
  | { ok: false; status: number; message: string };

/** Copies Better Auth's Set-Cookie headers so they can be attached to a React Router redirect. */
function cookieHeaders(response: Response): Headers {
  const headers = new Headers();
  for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return headers;
}

const TOO_MANY = "Too many attempts. Please wait a minute and try again.";

export async function signInWithEmail(env: AppEnv, request: Request, input: LoginInput): Promise<AuthResult> {
  try {
    const response = await getAuth(env).api.signInEmail({
      body: { email: input.email, password: input.password },
      headers: request.headers,
      asResponse: true,
    });
    if (response.ok) return { ok: true, headers: cookieHeaders(response) };
    if (response.status === 429) return { ok: false, status: 429, message: TOO_MANY };
    // Same message for "unknown email" and "wrong password": do not reveal which accounts exist.
    return { ok: false, status: 401, message: "Incorrect email or password." };
  } catch (error) {
    logger.error("sign-in failed unexpectedly", { error });
    return { ok: false, status: 500, message: "We could not sign you in right now. Please try again." };
  }
}

export async function signUpWithEmail(env: AppEnv, request: Request, input: RegisterInput): Promise<AuthResult> {
  try {
    const response = await getAuth(env).api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
      headers: request.headers,
      asResponse: true,
    });
    if (response.ok) return { ok: true, headers: cookieHeaders(response) };
    if (response.status === 429) return { ok: false, status: 429, message: TOO_MANY };
    return {
      ok: false,
      status: 400,
      message: "We could not create the account. If you already registered with this email, please log in.",
    };
  } catch (error) {
    logger.error("sign-up failed unexpectedly", { error });
    return { ok: false, status: 500, message: "We could not create your account right now. Please try again." };
  }
}

export async function signOutUser(env: AppEnv, request: Request): Promise<Headers> {
  try {
    const response = await getAuth(env).api.signOut({ headers: request.headers, asResponse: true });
    return cookieHeaders(response);
  } catch (error) {
    logger.error("sign-out failed unexpectedly", { error });
    return new Headers();
  }
}
