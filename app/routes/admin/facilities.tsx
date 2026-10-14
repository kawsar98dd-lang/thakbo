import { data, Form } from "react-router";
import type { Route } from "./+types/facilities";
import { PageHeader } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Badge } from "~/components/ui/Badge";
import { Card } from "~/components/ui/Card";
import { cloudflareContext } from "~/server/context.server";
import { listAdminFacilities, updateAdminFacilityStatus } from "~/server/db/repositories/admin-console";
import { requireAdmin } from "~/server/session.server";

export const meta = () => [{ title: "Facilities · THAKBO Admin" }, { name: "robots", content: "noindex" }];
export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext); await requireAdmin(context, request, env.DB);
  return { facilities: await listAdminFacilities(env.DB) };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(context, request, env.DB);
  const form = await request.formData();
  const rawId = form.get("id");
  const rawActive = form.get("isActive");
  if (typeof rawId !== "string" || !/^\d{1,9}$/.test(rawId) || !["0", "1"].includes(String(rawActive))) {
    return data({ ok: false, message: "Invalid facility update." }, { status: 400 });
  }
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return data({ ok: false, message: "Invalid facility ID." }, { status: 400 });
  }
  const ok = await updateAdminFacilityStatus(env.DB, id, rawActive === "1");
  return data({ ok, message: ok ? "Facility visibility updated." : "Facility not found." }, { status: ok ? 200 : 404 });
}

export default function AdminFacilities({ loaderData, actionData }: Route.ComponentProps) {
  const active = loaderData.facilities.filter((f) => f.isActive).length;
  return <>
    <PageHeader title="Facilities catalogue" description={`${active} active of ${loaderData.facilities.length} facilities. Admins can safely enable or hide facilities; existing listing references are preserved.`} />
    {actionData ? <div className="mb-4"><Alert tone={actionData.ok ? "success" : "error"}>{actionData.message}</Alert></div> : null}
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{loaderData.facilities.map((facility) => <li key={facility.id}><Card className="h-full"><div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{facility.name}</h2><Badge tone={facility.isActive ? "brand" : "warning"}>{facility.isActive ? "Active" : "Inactive"}</Badge></div><p className="mt-1 text-sm text-slate-600">Slug: {facility.slug}</p><p className="text-sm text-slate-600">Sort order: {facility.sortOrder}{facility.icon ? ` · Icon: ${facility.icon}` : ""}</p>
        <Form method="post" className="mt-3 border-t border-slate-200 pt-3"><input type="hidden" name="id" value={facility.id} /><input type="hidden" name="isActive" value={facility.isActive ? "0" : "1"} />
          <Button type="submit" variant={facility.isActive ? "secondary" : "primary"} className="w-full">{facility.isActive ? "Hide from new listings and search" : "Enable for new listings and search"}</Button>
        </Form></Card></li>)}</ul>
    <p className="mt-4 text-xs text-slate-500">Hiding a facility removes it from new listing choices and public filters. Existing listing links are retained, so historical data is not deleted.</p>
  </>;
}
