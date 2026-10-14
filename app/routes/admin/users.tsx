import { Form } from "react-router";
import type { Route } from "./+types/users";
import { PageHeader } from "~/components/layout/PageContainer";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { EmptyState } from "~/components/ui/EmptyState";
import { cloudflareContext } from "~/server/context.server";
import { listAdminUsersPage } from "~/server/db/repositories/admin-console";
import { requireAdmin } from "~/server/session.server";

export const meta = () => [{ title: "Users · THAKBO Admin" }, { name: "robots", content: "noindex" }];
export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext); await requireAdmin(context, request, env.DB);
  const url = new URL(request.url);
  const rawPage = Number(url.searchParams.get("page") || "1");
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 1;
  const query = (url.searchParams.get("q") || "").trim().slice(0, 100);
  let result = await listAdminUsersPage(env.DB, { query, page, pageSize: 25 });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  // If records were deleted since the user copied a deep page URL, return the last valid page.
  if (page > totalPages) result = await listAdminUsersPage(env.DB, { query, page: totalPages, pageSize: 25 });
  return { ...result, totalPages, query };
}
export default function AdminUsers({ loaderData }: Route.ComponentProps) {
  const { users, total, page, totalPages, query } = loaderData;
  const pageUrl = (target: number) => `/admin/users?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(target) })}`;
  return <>
    <PageHeader title="User accounts" description="Search accounts by name or email. Account suspension is intentionally not exposed until a safe recovery and audit workflow exists." />
    <Form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor="user-search">Search users</label>
      <input id="user-search" name="q" type="search" maxLength={100} defaultValue={query} placeholder="Search name, display name or email" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base" />
      <Button type="submit">Search users</Button>
      {query ? <a className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 font-semibold" href="/admin/users">Clear</a> : null}
    </Form>
    <p className="mb-3 text-sm text-slate-600">{total} account{total === 1 ? "" : "s"} found · Page {page} of {totalPages}</p>
    {!users.length ? <EmptyState icon="user" title="No accounts found" description={query ? "Try a different name or email." : "New accounts will appear here."} /> :
      <div className="space-y-3">{users.map((user) => <Card key={user.id} className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{user.displayName || user.name}</h2>{user.role ? <Badge tone="brand">{user.role}</Badge> : <Badge>Member</Badge>}</div>
        <p className="break-all text-sm text-slate-700">{user.email}</p>
        <p className="text-xs text-slate-500">Joined {user.createdAt.slice(0, 10)} · Account ID: {user.id}</p>
      </Card>)}</div>}
    {totalPages > 1 ? <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="User result pages">
      <a aria-disabled={page <= 1} className={`inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold ${page <= 1 ? "pointer-events-none border-slate-200 text-slate-400" : "border-slate-300 text-brand-800"}`} href={pageUrl(Math.max(1, page - 1))}>Previous</a>
      <span className="text-sm text-slate-600">Page {page} / {totalPages}</span>
      <a aria-disabled={page >= totalPages} className={`inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold ${page >= totalPages ? "pointer-events-none border-slate-200 text-slate-400" : "border-slate-300 text-brand-800"}`} href={pageUrl(Math.min(totalPages, page + 1))}>Next</a>
    </nav> : null}
  </>;
}
