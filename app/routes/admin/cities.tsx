import { data, Form } from "react-router";
import type { Route } from "./+types/cities";
import { PageHeader } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { cloudflareContext } from "~/server/context.server";
import { listAdminCitiesPage, updateAdminCityStatus } from "~/server/db/repositories/admin-console";
import { requireAdmin } from "~/server/session.server";

export const meta = () => [{ title: "Cities · THAKBO Admin" }, { name: "robots", content: "noindex" }];

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(context, request, env.DB);
  const url = new URL(request.url);
  const rawPage = Number(url.searchParams.get("page") || "1");
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 1;
  const query = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const result = await listAdminCitiesPage(env.DB, { query, page, pageSize: 25 });
  return { ...result, totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)), query };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(context, request, env.DB);
  const form = await request.formData();
  const rawId = form.get("cityId");
  const rawActive = form.get("isActive");
  if (typeof rawId !== "string" || !/^\d{1,9}$/.test(rawId) || !["0", "1"].includes(String(rawActive))) {
    return data({ ok: false, message: "Invalid city update." }, { status: 400 });
  }
  const cityId = Number(rawId);
  if (!Number.isSafeInteger(cityId) || cityId < 1) return data({ ok: false, message: "Invalid city ID." }, { status: 400 });
  const ok = await updateAdminCityStatus(env.DB, cityId, rawActive === "1");
  return data({ ok, message: ok ? "City visibility updated." : "City not found, or its district/division/country is inactive." }, { status: ok ? 200 : 409 });
}

export default function AdminCities({ loaderData, actionData }: Route.ComponentProps) {
  const { cities, total, page, totalPages, query } = loaderData;
  const pageUrl = (target: number) => `/admin/cities?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(target) })}`;
  const active = cities.filter((city) => city.isActive && city.districtActive && city.divisionActive && city.countryActive).length;
  return <>
    <PageHeader title="City catalogue" description={`${total} cities found. ${active} visible in the current page with active administrative ancestors. City visibility changes never delete city or listing data.`} />
    {actionData ? <div className="mb-4"><Alert tone={actionData.ok ? "success" : "error"}>{actionData.message}</Alert></div> : null}
    <Form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor="city-search">Search cities</label>
      <input id="city-search" name="q" type="search" maxLength={100} defaultValue={query} placeholder="Search city, district, division or slug" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base" />
      <Button type="submit">Search cities</Button>
      {query ? <a className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 font-semibold" href="/admin/cities">Clear</a> : null}
    </Form>
    {cities.length === 0 ? <Card><p className="font-semibold">No cities found</p><p className="mt-1 text-sm text-slate-600">Try another city name or slug.</p></Card> :
      <div className="space-y-3">{cities.map((city) => {
        const ancestorsActive = Boolean(city.districtActive && city.divisionActive && city.countryActive);
        return <Card key={city.id} className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><h2 className="font-semibold">{city.nameBn ? `${city.nameBn} · ${city.nameEn || city.name}` : city.name}</h2><p className="break-all text-sm text-slate-600">Slug: {city.slug} · {city.districtName}, {city.divisionName}</p><p className="text-sm text-slate-600">{city.areaCount} areas configured</p>
            <div className="mt-2 flex flex-wrap gap-2"><Badge tone={city.isActive ? "brand" : "warning"}>City {city.isActive ? "active" : "inactive"}</Badge><Badge tone={ancestorsActive ? "brand" : "warning"}>Ancestors {ancestorsActive ? "active" : "inactive"}</Badge></div>
          </div>
          <Form method="post" className="w-full border-t border-slate-200 pt-3 sm:w-auto sm:border-0 sm:pt-0"><input type="hidden" name="cityId" value={city.id} /><input type="hidden" name="isActive" value={city.isActive ? "0" : "1"} /><Button type="submit" className="w-full sm:w-auto" variant={city.isActive ? "secondary" : "primary"} disabled={!city.isActive && !ancestorsActive}>{city.isActive ? "Hide city from public search" : "Enable city"}</Button></Form>
        </Card>;
      })}</div>}
    {totalPages > 1 ? <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="City result pages">{page > 1 ? <a className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-semibold" href={pageUrl(page - 1)}>Previous</a> : <span />}<span className="text-sm text-slate-600">Page {page} / {totalPages}</span>{page < totalPages ? <a className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-semibold" href={pageUrl(page + 1)}>Next</a> : null}</nav> : null}
    <p className="mt-4 text-xs text-slate-500">Disabling a city hides its areas from public search through the active location hierarchy. Existing listings and city slugs are preserved. Re-enabling is allowed only when its district, division and country are active.</p>
  </>;
}
