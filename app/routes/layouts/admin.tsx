import { Outlet } from "react-router";
import type { Route } from "./+types/admin";
import { PageContainer } from "~/components/layout/PageContainer";
import { SubNav } from "~/components/layout/SubNav";
import { buildMeta } from "~/lib/seo";
import { PATHS } from "~/lib/routes";
import { adminRoleContext } from "~/server/context.server";
import { requireAdminMiddleware } from "~/server/middleware.server";

export const middleware: Route.MiddlewareFunction[] = [requireAdminMiddleware];

export const meta = () => buildMeta({ title: "Admin", description: "THAKBO administration.", noindex: true });

/** Having a loader makes the admin guard run on every client-side navigation into /admin/*. */
export function loader({ context }: Route.LoaderArgs) {
  return { role: context.get(adminRoleContext) };
}

export default function AdminLayout() {
  return (
    <PageContainer>
      <SubNav
        label="Admin"
        items={[
          { to: PATHS.admin, label: "Overview", end: true },
          { to: PATHS.adminUsers, label: "Users" },
          { to: PATHS.adminListings, label: "Listings" },
          { to: PATHS.adminReports, label: "Reports" },
          { to: PATHS.adminLocations, label: "Locations" },
          { to: PATHS.adminFacilities, label: "Facilities" },
          { to: PATHS.adminSettings, label: "Settings" },
        ]}
      />
      <Outlet />
    </PageContainer>
  );
}
