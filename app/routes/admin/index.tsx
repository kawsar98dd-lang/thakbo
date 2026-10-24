import { Link } from "react-router";
import type { Route } from "./+types/index";
import { PageHeader } from "~/components/layout/PageContainer";
import { Card } from "~/components/ui/Card";
import { ButtonLink } from "~/components/ui/Button";
import { PATHS } from "~/lib/routes";
import { cloudflareContext } from "~/server/context.server";
import { getAdminOverview } from "~/server/db/repositories/admin-console";
import { requireAdmin } from "~/server/session.server";

export const meta = () => [{ title: "Admin overview · THAKBO" }, { name: "robots", content: "noindex" }];
export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(context, request, env.DB);
  return await getAdminOverview(env.DB);
}

export default function AdminOverview({ loaderData }: Route.ComponentProps) {
  const stats = [
    { label: "Accounts", value: statsValue(loaderData.users), to: PATHS.adminUsers },
    { label: "Published listings", value: statsValue(loaderData.published), to: `${PATHS.adminListings}?status=published` },
    { label: "Waiting for review", value: statsValue(loaderData.pending), to: `${PATHS.adminListings}?status=pending` },
    { label: "Pending reports", value: statsValue(loaderData.pendingReports), to: PATHS.adminReports },
    { label: "Open contact messages", value: statsValue(loaderData.openContactMessages), to: PATHS.adminContactMessages },
    { label: "Visitor analytics", value: "View reports", to: PATHS.adminAnalytics },
  ];
  return <>
    <PageHeader title="Admin overview" description="A live summary of the THAKBO database and shortcuts to moderation." />
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{stats.map((item) => <li key={item.label}><Card className="h-full"><p className="text-sm text-slate-600">{item.label}</p><p className="my-2 text-3xl font-bold">{item.value}</p><Link className="font-semibold text-brand-800 underline" to={item.to}>Open section →</Link></Card></li>)}</ul>
    <div className="mt-5"><ButtonLink to={PATHS.adminListings}>Review listings</ButtonLink></div>
  </>;
}
function statsValue(value: number) { return new Intl.NumberFormat("en-BD").format(value); }
