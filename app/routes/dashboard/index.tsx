import type { Route } from "./+types/index";
import { PageHeader } from "~/components/layout/PageContainer";
import { Card } from "~/components/ui/Card";
import { requireUser } from "~/server/session.server";

export function loader({ context, request }: Route.LoaderArgs) {
  const user = requireUser(context, request);
  return { name: user.name };
}

export default function DashboardHome({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader title={`Welcome, ${loaderData.name}`} description="Your saved places and listings will be managed here." />
      <Card>
        <p className="text-slate-700">Profile, saved places and listing management are coming in Milestones 2, 3 and 6.</p>
      </Card>
    </>
  );
}
