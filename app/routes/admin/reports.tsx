import { data, Form, Link } from "react-router";
import type { Route } from "./+types/reports";
import { PageHeader } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { EmptyState } from "~/components/ui/EmptyState";
import { REPORT_STATUSES, type ReportStatus } from "~/lib/constants";
import { cloudflareContext } from "~/server/context.server";
import { listAdminReportsPage, updateAdminReport } from "~/server/db/repositories/admin-console";
import { requireAdmin } from "~/server/session.server";

const labels: Record<string, string> = { fake_listing: "Fake listing", wrong_information: "Incorrect information", already_rented: "Already rented", inappropriate_content: "Inappropriate content", spam: "Spam", duplicate: "Duplicate", other: "Other" };
export const meta = () => [{ title: "Reports · THAKBO Admin" }, { name: "robots", content: "noindex" }];
export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext); await requireAdmin(context, request, env.DB);
  const params = new URL(request.url).searchParams;
  const raw = params.get("status");
  const status: ReportStatus | "all" = raw === "all" ? "all" : REPORT_STATUSES.includes(raw as ReportStatus) ? raw as ReportStatus : "pending";
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 1;
  return { status, ...(await listAdminReportsPage(env.DB, status, { page, pageSize: 25 })) };
}
export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext); await requireAdmin(context, request, env.DB);
  const form = await request.formData();
  const id = form.get("id"), rawStatus = form.get("status"), rawNote = form.get("adminNote");
  if (typeof id !== "string" || id.length < 1 || id.length > 100 || typeof rawStatus !== "string" || !REPORT_STATUSES.includes(rawStatus as ReportStatus)) {
    return data({ ok: false, message: "Invalid report update." }, { status: 400 });
  }
  const note = typeof rawNote === "string" ? rawNote.trim() : "";
  if (note.length > 1000) return data({ ok: false, message: "Admin note must be 1,000 characters or fewer." }, { status: 400 });
  const ok = await updateAdminReport(env.DB, id, rawStatus as ReportStatus, note || null);
  return data({ ok, message: ok ? "Report updated." : "Report not found." }, { status: ok ? 200 : 404 });
}
export default function AdminReports({ loaderData, actionData }: Route.ComponentProps) {
  return <>
    <PageHeader title="Listing reports" description="Review reports submitted by signed-in users. Save a status and an internal note for the moderation record." />
    {actionData ? <div className="mb-4"><Alert tone={actionData.ok ? "success" : "error"}>{actionData.message}</Alert></div> : null}
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Report status">{["pending", "reviewed", "resolved", "dismissed", "all"].map((s) => <a key={s} href={`/admin/reports?status=${s}`} aria-current={loaderData.status === s ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold ${loaderData.status === s ? "bg-brand-700 text-white" : "border border-slate-300 bg-white"}`}>{s[0].toUpperCase() + s.slice(1)}</a>)}</nav>
    <p className="mb-3 text-sm text-slate-600">{loaderData.total} report(s) · Page {loaderData.page} of {Math.max(1, Math.ceil(loaderData.total / loaderData.pageSize))}</p>
    {!loaderData.reports.length ? <EmptyState icon="check" title="No reports in this view" description="Reports will appear here when users flag a published listing." /> :
      <div className="space-y-4">{loaderData.reports.map((r) => <Card key={r.id} className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold">{r.listingTitle || "Listing removed"}</h2><p className="text-xs text-slate-500">{r.createdAt.slice(0, 16).replace("T", " ")} UTC · Report ID {r.id}</p></div><Badge tone={r.status === "pending" ? "warning" : r.status === "resolved" ? "brand" : "neutral"}>{r.status}</Badge></div>
        <p className="text-sm"><strong>Reason:</strong> {labels[r.reason] || r.reason}</p>
        {r.details ? <p className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm">{r.details}</p> : null}
        <p className="break-all text-xs text-slate-500">Reported by: {r.reporterName || "Deleted/unknown user"}{r.reporterEmail ? ` (${r.reporterEmail})` : ""}</p>
        {r.listingSlug ? <a className="font-semibold text-brand-800 underline" href={`/listing/${encodeURIComponent(r.listingSlug)}`} target="_blank" rel="noreferrer">Open public listing ↗</a> : null}
        <Form method="post" className="space-y-2 border-t border-slate-200 pt-3"><input type="hidden" name="id" value={r.id} />
          <label className="block text-sm font-medium" htmlFor={`status-${r.id}`}>Status</label><select id={`status-${r.id}`} name="status" defaultValue={r.status} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">{REPORT_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select>
          <label className="block text-sm font-medium" htmlFor={`note-${r.id}`}>Internal note</label><textarea id={`note-${r.id}`} name="adminNote" maxLength={1000} rows={2} defaultValue={r.adminNote || ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          <Button type="submit">Save report review</Button>
        </Form>
      </Card>)}</div>}
    <nav aria-label="Report pages" className="mt-5 flex items-center justify-between gap-3">
      {loaderData.page > 1 ? <Link className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-semibold" to={`/admin/reports?status=${loaderData.status}&page=${loaderData.page - 1}`}>Previous</Link> : <span />}
      {loaderData.page < Math.max(1, Math.ceil(loaderData.total / loaderData.pageSize)) ? <Link className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-semibold" to={`/admin/reports?status=${loaderData.status}&page=${loaderData.page + 1}`}>Next</Link> : null}
    </nav>
  </>;
}
