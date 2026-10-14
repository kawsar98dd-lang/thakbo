import { data, Form, Link } from "react-router";
import type { Route } from "./+types/contact-messages";
import { PageHeader } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { EmptyState } from "~/components/ui/EmptyState";
import { cloudflareContext } from "~/server/context.server";
import { execute, queryAll, queryFirst } from "~/server/db/client";
import { requireAdmin } from "~/server/session.server";

const STATUSES = ["open", "in_progress", "closed"] as const;
type MessageStatus = typeof STATUSES[number];
interface ContactMessageRow {
  id: string; name: string; email: string; subject: string; message: string; status: MessageStatus;
  adminNote: string | null; createdAt: string; updatedAt: string;
}
export const meta = () => [{ title: "Contact inbox · THAKBO Admin" }, { name: "robots", content: "noindex" }];

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(context, request, env.DB);
  const params = new URL(request.url).searchParams;
  const rawStatus = params.get("status") ?? "open";
  const status: MessageStatus | "all" = rawStatus === "all" ? "all" : STATUSES.includes(rawStatus as MessageStatus) ? rawStatus as MessageStatus : "open";
  const rawPage = Number(params.get("page") ?? "1");
  const requestedPage = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 1;
  const where = status === "all" ? "" : "WHERE status = ?";
  const paramsForCount = status === "all" ? [] : [status];
  const pageSize = 20;
  try {
    const count = await queryFirst<{ total: number }>(env.DB, `SELECT COUNT(*) AS total FROM contact_messages ${where}`, paramsForCount);
    const total = count?.total ?? 0;
    const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
    const messages = await queryAll<ContactMessageRow>(env.DB,
      `SELECT id, name, email, subject, message, status, admin_note AS adminNote, created_at AS createdAt, updated_at AS updatedAt
       FROM contact_messages ${where}
       ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, created_at DESC, id DESC
       LIMIT ? OFFSET ?`, [...paramsForCount, pageSize, (page - 1) * pageSize]);
    return { status, messages, total, page, pageSize, migrationReady: true };
  } catch {
    return { status, messages: [] as ContactMessageRow[], total: 0, page: 1, pageSize, migrationReady: false };
  }
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(context, request, env.DB);
  const form = await request.formData();
  const id = form.get("id"), rawStatus = form.get("status"), rawNote = form.get("adminNote");
  if (typeof id !== "string" || id.length < 1 || id.length > 100 || typeof rawStatus !== "string" || !STATUSES.includes(rawStatus as MessageStatus)) {
    return data({ ok: false, message: "Invalid contact message update." }, { status: 400 });
  }
  const note = typeof rawNote === "string" ? rawNote.trim() : "";
  if (note.length > 1000) return data({ ok: false, message: "Internal note must be 1,000 characters or fewer." }, { status: 400 });
  const result = await execute(env.DB,
    "UPDATE contact_messages SET status = ?, admin_note = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    [rawStatus, note || null, id]);
  const ok = (result.meta.changes ?? 0) > 0;
  return data({ ok, message: ok ? "Contact message updated." : "Message not found." }, { status: ok ? 200 : 404 });
}

export default function AdminContactMessages({ loaderData, actionData }: Route.ComponentProps) {
  const pages = Math.max(1, Math.ceil(loaderData.total / loaderData.pageSize));
  return <>
    <PageHeader title="Contact inbox" description="Review messages submitted through the public contact form. Replies are not sent automatically; use the sender email to reply from your chosen mail app." />
    {actionData ? <div className="mb-4"><Alert tone={actionData.ok ? "success" : "error"}>{actionData.message}</Alert></div> : null}
    {!loaderData.migrationReady ? <div className="mb-4"><Alert tone="info" title="Contact inbox setup required">The contact inbox database migration has not been applied or is currently unavailable. Run the guarded production database workflow and apply migration 0009 before using this page.</Alert></div> : null}
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Contact message status">
      {["open", "in_progress", "closed", "all"].map((value) => <a key={value} href={`/admin/contact-messages?status=${value}`} aria-current={loaderData.status === value ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold ${loaderData.status === value ? "bg-brand-700 text-white" : "border border-slate-300 bg-white"}`}>{value === "in_progress" ? "In progress" : value[0].toUpperCase() + value.slice(1)}</a>)}
    </nav>
    <p className="mb-3 text-sm text-slate-600">{loaderData.total} message(s) · Page {loaderData.page} of {pages}</p>
    {!loaderData.messages.length ? <EmptyState icon="check" title="No messages in this view" description="New contact form submissions will appear here." /> :
      <div className="space-y-4">{loaderData.messages.map((message) => <Card key={message.id} className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold">{message.subject}</h2><p className="text-xs text-slate-500">{message.createdAt.slice(0, 16).replace("T", " ")} UTC · {message.name}</p></div><Badge tone={message.status === "open" ? "warning" : message.status === "closed" ? "brand" : "neutral"}>{message.status === "in_progress" ? "In progress" : message.status}</Badge></div>
        <p className="text-sm"><strong>From:</strong> <a className="break-all text-brand-800 underline" href={`mailto:${encodeURIComponent(message.email)}`}>{message.email}</a></p>
        <p className="whitespace-pre-line break-words rounded-lg bg-slate-50 p-3 text-sm">{message.message}</p>
        <Form method="post" className="space-y-2 border-t border-slate-200 pt-3"><input type="hidden" name="id" value={message.id} />
          <label className="block text-sm font-medium" htmlFor={`status-${message.id}`}>Status</label><select id={`status-${message.id}`} name="status" defaultValue={message.status} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">{STATUSES.map((s) => <option key={s} value={s}>{s === "in_progress" ? "In progress" : s[0].toUpperCase() + s.slice(1)}</option>)}</select>
          <label className="block text-sm font-medium" htmlFor={`note-${message.id}`}>Internal note</label><textarea id={`note-${message.id}`} name="adminNote" maxLength={1000} rows={2} defaultValue={message.adminNote ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          <Button type="submit">Save message review</Button>
        </Form>
      </Card>)}</div>}
    <nav aria-label="Contact inbox pages" className="mt-5 flex items-center justify-between gap-3">
      {loaderData.page > 1 ? <Link className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-semibold" to={`/admin/contact-messages?status=${loaderData.status}&page=${loaderData.page - 1}`}>Previous</Link> : <span />}
      {loaderData.page < pages ? <Link className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-semibold" to={`/admin/contact-messages?status=${loaderData.status}&page=${loaderData.page + 1}`}>Next</Link> : null}
    </nav>
  </>;
}
