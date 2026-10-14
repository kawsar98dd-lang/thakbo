import type { Route } from "./+types/settings";
import { PageHeader } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Badge } from "~/components/ui/Badge";
import { Card } from "~/components/ui/Card";
import { cloudflareContext } from "~/server/context.server";
import { requireAdmin } from "~/server/session.server";

export const meta = () => [{ title: "Platform settings · THAKBO Admin" }, { name: "robots", content: "noindex" }];
export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext); await requireAdmin(context, request, env.DB);
  return {
    appName: env.APP_NAME || "THAKBO",
    authSecretConfigured: typeof env.BETTER_AUTH_SECRET === "string" && env.BETTER_AUTH_SECRET.length >= 32,
    authUrlConfigured: Boolean(env.BETTER_AUTH_URL),
    d1Bound: Boolean(env.DB), r2Bound: Boolean(env.MEDIA_BUCKET),
  };
}
function State({ ok }: { ok: boolean }) { return <Badge tone={ok ? "brand" : "warning"}>{ok ? "Configured in runtime" : "Not confirmed"}</Badge>; }
export default function AdminSettings({ loaderData }: Route.ComponentProps) {
  return <>
    <PageHeader title="Platform settings" description="Safe runtime diagnostics. Secret values are never displayed or returned to the browser." />
    <Alert tone="info">This page does not edit Cloudflare secrets, D1 bindings, or R2 configuration. Those changes must be made in Cloudflare/GitHub settings.</Alert>
    <div className="mt-4 space-y-3"><Card className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Application name</h2><p className="text-sm text-slate-600">Runtime APP_NAME</p></div><span>{loaderData.appName}</span></Card>
      <Card className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">D1 database binding</h2><p className="text-sm text-slate-600">Binding name DB</p></div><State ok={loaderData.d1Bound} /></Card>
      <Card className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">R2 media binding</h2><p className="text-sm text-slate-600">Binding name MEDIA_BUCKET</p></div><State ok={loaderData.r2Bound} /></Card>
      <Card className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Authentication secret</h2><p className="text-sm text-slate-600">Only checks presence and minimum length; never shows the value.</p></div><State ok={loaderData.authSecretConfigured} /></Card>
      <Card className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Authentication base URL</h2><p className="text-sm text-slate-600">BETTER_AUTH_URL</p></div><State ok={loaderData.authUrlConfigured} /></Card>
    </div>
  </>;
}
