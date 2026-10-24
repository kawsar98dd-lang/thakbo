import { Link } from "react-router";
import type { Route } from "./+types/analytics";
import { PageHeader } from "~/components/layout/PageContainer";
import { Card } from "~/components/ui/Card";
import { cloudflareContext } from "~/server/context.server";
import { getAdminAnalytics } from "~/server/analytics/analytics.server";
import { requireAdmin } from "~/server/session.server";

export const meta = () => [{ title: "Visitor analytics · THAKBO Admin" }, { name: "robots", content: "noindex" }];

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(context, request, env.DB);
  return getAdminAnalytics(env.DB);
}

function number(value: number) { return new Intl.NumberFormat("en-BD").format(value); }

export default function AdminAnalytics({ loaderData }: Route.ComponentProps) {
  const { summary, popularListings, dailyViews } = loaderData;
  const cards = [
    { label: "All tracked page views", value: summary.allViews },
    { label: "Listing views", value: summary.listingViews },
    { label: "Views today", value: summary.todayViews },
    { label: "Last 7 days", value: summary.last7Days },
    { label: "Last 30 days", value: summary.last30Days },
  ];
  const maxViews = Math.max(1, ...dailyViews.map((item) => item.views));
  return <>
    <PageHeader title="Visitor analytics" description="Privacy-conscious view statistics for the homepage and listing detail pages. Automated bots are excluded when detectable; unique visitors are not currently measured." />
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map((item) => <li key={item.label}><Card><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-3xl font-bold tabular-nums text-brand-800">{number(item.value)}</p></Card></li>)}</ul>
    <section className="mt-6" aria-labelledby="daily-views-heading">
      <h2 id="daily-views-heading" className="mb-3 text-xl font-bold">Daily views · last 30 days</h2>
      <Card>
        {dailyViews.length ? <div className="space-y-3">{dailyViews.map((item) => <div key={item.day} className="grid grid-cols-[5.5rem_minmax(0,1fr)_4rem] items-center gap-3 text-sm">
          <span className="text-slate-600">{item.day}</span>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${item.views} total views, ${item.listingViews} listing views`}><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max(item.views > 0 ? 2 : 0, (item.views / maxViews) * 100)}%` }} /></div>
          <span className="text-right font-semibold tabular-nums">{number(item.views)}</span>
        </div>)}</div> : <p className="text-sm text-slate-600">No analytics recorded yet. Views will appear after the migration is applied and visitors browse the site.</p>}
      </Card>
    </section>
    <section className="mt-6" aria-labelledby="popular-listings-heading">
      <h2 id="popular-listings-heading" className="mb-3 text-xl font-bold">Most viewed listings</h2>
      <Card>
        {popularListings.length ? <div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-600"><th className="py-3 pr-3 font-semibold">Listing</th><th className="py-3 pr-3 font-semibold">Total views</th><th className="py-3 font-semibold">Link</th></tr></thead><tbody>{popularListings.map((item) => <tr key={item.listingId} className="border-b border-slate-100 last:border-0"><td className="py-3 pr-3 font-medium">{item.title}</td><td className="py-3 pr-3 tabular-nums">{number(item.views)}</td><td className="py-3">{item.slug ? <Link className="font-semibold text-brand-800 underline" to={`/listing/${encodeURIComponent(item.slug)}`}>Open listing</Link> : <span className="text-slate-500">Unavailable</span>}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-600">No listing views recorded yet.</p>}
      </Card>
    </section>
    <p className="mt-5 text-xs leading-5 text-slate-500">Privacy note: this dashboard stores daily aggregate counts and hashed random browser identifiers for deduplication. It does not store raw IP addresses, account IDs, or full browsing histories.</p>
  </>;
}
