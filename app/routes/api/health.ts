import type { Route } from "./+types/health";
import { cloudflareContext } from "~/server/context.server";
import { queryFirst } from "~/server/db/client";

/**
 * Read-only operational check for the owner. Reveals dependency status only, never IDs, keys or exception details.
 * D1 uses SELECT 1; R2 uses a HEAD against a reserved, non-created key (no listing or write permission required).
 */
export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const checks = {
    database: "ok" as "ok" | "unavailable",
    media: "ok" as "ok" | "unavailable",
    auth: "configured" as "configured" | "missing",
  };

  try {
    await queryFirst<{ ok: number }>(env.DB, "SELECT 1 AS ok");
  } catch {
    checks.database = "unavailable";
  }

  try {
    await env.MEDIA_BUCKET.head("__thakbo_healthcheck_reserved__");
  } catch {
    checks.media = "unavailable";
  }

  if (typeof env.BETTER_AUTH_SECRET !== "string" || env.BETTER_AUTH_SECRET.length < 32) {
    checks.auth = "missing";
  }

  const healthy = checks.database === "ok" && checks.media === "ok" && checks.auth === "configured";
  return Response.json(
    { status: healthy ? "ok" : "degraded", ...checks },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
