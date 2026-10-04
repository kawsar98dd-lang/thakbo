import { Outlet } from "react-router";
import type { Route } from "./+types/dashboard";
import { PageContainer } from "~/components/layout/PageContainer";
import { SubNav } from "~/components/layout/SubNav";
import { buildMeta } from "~/lib/seo";
import { PATHS } from "~/lib/routes";
import { requireUserMiddleware } from "~/server/middleware.server";
import { requireUser } from "~/server/session.server";

export const middleware: Route.MiddlewareFunction[] = [requireUserMiddleware];

export const meta = () => buildMeta({ title: "Dashboard", description: "Manage your THAKBO account.", noindex: true });

/** Having a loader makes the guard run on every client-side navigation into /dashboard/*. */
export function loader({ context, request }: Route.LoaderArgs) {
  requireUser(context, request);
  return null;
}

export default function DashboardLayout() {
  return (
    <PageContainer>
      <SubNav
        label="Dashboard"
        items={[
          { to: PATHS.dashboard, label: "Overview", end: true },
          { to: PATHS.myListings, label: "My listings" },
          { to: PATHS.favorites, label: "Saved" },
          { to: PATHS.profile, label: "Profile" },
        ]}
      />
      <Outlet />
    </PageContainer>
  );
}
