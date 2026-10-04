import { Outlet, useRouteError, useRouteLoaderData } from "react-router";
import { AppShell } from "~/components/layout/AppShell";
import { RouteError } from "~/components/layout/RouteError";
import type { RootLoaderData } from "~/lib/types";

export default function PublicLayout() {
  const root = useRouteLoaderData<RootLoaderData>("root");
  return (
    <AppShell user={root?.user ?? null}>
      <Outlet />
    </AppShell>
  );
}

/** Errors in any page below keep the header/footer visible and show a friendly message. */
export function ErrorBoundary() {
  const root = useRouteLoaderData<RootLoaderData>("root");
  const error = useRouteError();
  return (
    <AppShell user={root?.user ?? null}>
      <RouteError error={error} />
    </AppShell>
  );
}
