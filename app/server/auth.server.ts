import { betterAuth } from "better-auth";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { assertAuthEnv, type AppEnv } from "./env.server";
import { ensureProfile } from "./db/repositories/profiles";
import { logger } from "./logger.server";

/**
 * Better Auth handles passwords (hashing), sessions and cookies. THAKBO never implements those itself.
 * The D1 binding exists only while a request is running, so the instance is created per request
 * (and cached per binding object).
 */
export function createAuth(env: AppEnv) {
  assertAuthEnv(env);

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || undefined,
    database: {
      db: new Kysely<unknown>({ dialect: new D1Dialect({ database: env.DB }) }),
      type: "sqlite",
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      // Password reset needs an e-mail provider. It is intentionally not enabled in Milestone 1.
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    databaseHooks: {
      user: {
        create: {
          // One account system: every new user automatically gets a THAKBO profile.
          after: async (user) => {
            try {
              await ensureProfile(env.DB, user.id, user.name);
            } catch (error) {
              logger.error("profile creation failed", { userId: user.id, error });
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

const cache = new WeakMap<D1Database, Auth>();

export function getAuth(env: AppEnv): Auth {
  let auth = cache.get(env.DB);
  if (!auth) {
    auth = createAuth(env);
    cache.set(env.DB, auth);
  }
  return auth;
}
