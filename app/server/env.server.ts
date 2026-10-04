import { z } from "zod";

/**
 * Everything the Worker can access at runtime.
 * DB and MEDIA_BUCKET are Cloudflare BINDINGS (no keys); the rest are variables/secrets.
 * This type is server-only: it is never sent to the browser.
 */
export interface AppEnv {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  APP_NAME?: string;
}

const secretsSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters."),
  BETTER_AUTH_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
});

/** Throws a clear (server-side only) error when required secrets are missing or malformed. */
export function assertAuthEnv(env: AppEnv): void {
  const result = secretsSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server configuration (${problems}). See README → "Environment variables".`);
  }
}
