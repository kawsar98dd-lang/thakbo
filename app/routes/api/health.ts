import type { Route } from "./+types/health";
import { cloudflareContext } from "~/server/context.server";
import { queryFirst } from "~/server/db/client";

/** Quick check for the owner: open /api/health after deploying. Reveals no internal details. */
export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  let database: "ok" | "unavailable" = "ok";
  try {
    await queryFirst<{ ok: number }>(env.DB, "SELECT 1 AS ok");
  } catch {
    database = "unavailable"; // details are already in the server logs
  }
  return Response.json(
    { status: database === "ok" ? "ok" : "degraded", database },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
