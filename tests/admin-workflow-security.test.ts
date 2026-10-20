import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contactInbox = readFileSync(new URL("../app/routes/admin/contact-messages.tsx", import.meta.url), "utf8");
const reports = readFileSync(new URL("../app/routes/admin/reports.tsx", import.meta.url), "utf8");

describe("admin contact and report workflow security regression checks", () => {
  it.each([
    ["contact inbox", contactInbox],
    ["listing reports", reports],
  ])("requires server-side admin authorization before handling %s requests", (_name, source) => {
    const loader = source.slice(source.indexOf("export async function loader"), source.indexOf("export async function action"));
    const action = source.slice(source.indexOf("export async function action"), source.indexOf("export default function"));
    expect(loader.indexOf("await requireAdmin(context, request, env.DB)")).toBeGreaterThanOrEqual(0);
    expect(loader.indexOf("await requireAdmin(context, request, env.DB)")).toBeLessThan(loader.indexOf("queryFirst<") >= 0 ? loader.indexOf("queryFirst<") : loader.indexOf("listAdminReportsPage"));
    expect(action.indexOf("await requireAdmin(context, request, env.DB)")).toBeGreaterThanOrEqual(0);
    expect(action.indexOf("await requireAdmin(context, request, env.DB)")).toBeLessThan(action.indexOf("request.formData()"));
  });

  it("keeps contact-message status updates allow-listed and parameterized", () => {
    expect(contactInbox).toContain('const STATUSES = ["open", "in_progress", "closed"] as const');
    expect(contactInbox).toContain('!STATUSES.includes(rawStatus as MessageStatus)');
    expect(contactInbox).toContain('WHERE id = ?');
    expect(contactInbox).toContain('[rawStatus, note || null, id]');
    expect(contactInbox).toContain('return data({ ok, message: ok ? "Contact message updated." : "Message not found." }');
    expect(contactInbox).not.toContain('message: String(error)');
  });

  it("validates report status and note length before changing the report", () => {
    expect(reports).toContain('!REPORT_STATUSES.includes(rawStatus as ReportStatus)');
    expect(reports).toContain('if (note.length > 1000)');
    expect(reports).toContain('updateAdminReport(env.DB, id, rawStatus as ReportStatus, note || null)');
    expect(reports).toContain('ok ? "Report updated." : "Report not found."');
    expect(reports).not.toContain('message: String(error)');
  });
});
