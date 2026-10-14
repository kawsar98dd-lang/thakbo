import { data, Form } from "react-router";
import type { Route } from "./+types/locations";
import { PageHeader } from "~/components/layout/PageContainer";
import { Badge } from "~/components/ui/Badge";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { cloudflareContext } from "~/server/context.server";
import { listAdminLocationsPage, updateAdminAreaStatus } from "~/server/db/repositories/admin-console";
import { requireAdmin } from "~/server/session.server";

export const meta = () => [{ title: "Locations · THAKBO Admin" }, { name: "robots", content: "noindex" }];
export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext); await requireAdmin(context, request, env.DB);
  const url = new URL(request.url);
  const rawPage = Number(url.searchParams.get("page") || "1");
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 1;
  const query = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const result = await listAdminLocationsPage(env.DB, { query, page, pageSize: 25 });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  return { ...result, totalPages, query };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(context, request, env.DB);
  const form = await request.formData();
  const rawId = form.get("areaId");
  const rawActive = form.get("isActive");
  if (typeof rawId !== "string" || !/^\d{1,9}$/.test(rawId) || !["0", "1"].includes(String(rawActive))) {
    return data({ ok: false, message: "Invalid location update." }, { status: 400 });
  }
  const areaId = Number(rawId);
  if (!Number.isSafeInteger(areaId) || areaId < 1) {
    return data({ ok: false, message: "Invalid area ID." }, { status: 400 });
  }
  const ok = await updateAdminAreaStatus(env.DB, areaId, rawActive === "1");
  return data({ ok, message: ok ? "Area visibility updated." : "Area not found, or its city/parent is inactive." }, { status: ok ? 200 : 409 });
}
export default function AdminLocations({ loaderData, actionData }: Route.ComponentProps) {
  const { locations, total, page, totalPages, query } = loaderData;
  const activeCities = new Set(locations.filter((l) => l.cityActive).map((l) => l.citySlug));
  const activeAreas = locations.filter((l) => l.areaActive).length;
  const pageUrl = (target: number) => `/admin/locations?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(target) })}`;
  return <>
    <PageHeader title="Location catalogue" description="Search and manage the visibility of cities' areas. Inactive items remain visible for auditability." />
    {actionData ? <div className="mb-4"><Alert tone={actionData.ok ? "success" : "error"}>{actionData.message}</Alert></div> : null}
    <Form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor="location-search">Search locations</label>
      <input id="location-search" name="q" type="search" maxLength={100} defaultValue={query} placeholder="Search area or city name / slug" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base" />
      <Button type="submit">Search locations</Button>
      {query ? <a className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 font-semibold" href="/admin/locations">Clear</a> : null}
    </Form>
    <div className="mb-4 grid gap-3 sm:grid-cols-2"><Card><p className="text-sm text-slate-600">Active cities on this page</p><p className="text-2xl font-bold">{activeCities.size}</p></Card><Card><p className="text-sm text-slate-600">Active areas on this page</p><p className="text-2xl font-bold">{activeAreas}</p></Card></div>
    <p className="mb-3 text-sm text-slate-600">{total} area record(s) found · Page {page} of {totalPages}</p>
    {!locations.length ? <Card><p className="text-sm text-slate-600">{query ? "No locations matched your search." : "No locations are configured yet."}</p></Card> :
      <div className="space-y-2">{locations.map((location) => <Card key={`${location.citySlug}:${location.areaSlug}`} className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">{location.areaName}{location.parentAreaId ? <span className="ml-2 text-xs text-slate-500">Sub-area</span> : null}</h2><p className="text-sm text-slate-600">{location.cityName} · /area/{location.citySlug}/{location.areaSlug}</p></div>
        <div className="flex flex-wrap items-center gap-2"><Badge tone={location.cityActive ? "brand" : "warning"}>City {location.cityActive ? "active" : "inactive"}</Badge><Badge tone={location.areaActive ? "brand" : "warning"}>Area {location.areaActive ? "active" : "inactive"}</Badge></div>
        <Form method="post" className="w-full border-t border-slate-200 pt-3 sm:w-auto sm:border-0 sm:pt-0"><input type="hidden" name="areaId" value={location.areaId} /><input type="hidden" name="isActive" value={location.areaActive ? "0" : "1"} /><Button type="submit" variant={location.areaActive ? "secondary" : "primary"} className="w-full sm:w-auto" disabled={!location.areaActive && !location.cityActive}>{location.areaActive ? "Hide area" : "Enable area"}</Button></Form>
      </Card>)}</div>}
    {totalPages > 1 ? <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="Location result pages">
      {page > 1 ? <a className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-semibold" href={pageUrl(page - 1)}>Previous</a> : <span />}
      <span className="text-sm text-slate-600">Page {page} / {totalPages}</span>
      {page < totalPages ? <a className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-semibold" href={pageUrl(page + 1)}>Next</a> : null}
    </nav> : null}
    <p className="mt-4 text-xs text-slate-500">Areas are paginated and can be searched by area or city. Visibility changes preserve database rows and public slugs. An area can only be enabled when its city and parent area (if any) are active.</p>
  </>;
}
