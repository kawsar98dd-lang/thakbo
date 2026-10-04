import type { Route } from "./+types/listings";
import { PlaceholderPage } from "~/components/layout/PlaceholderPage";
import { requireUser } from "~/server/session.server";

export function loader({ context, request }: Route.LoaderArgs) {
  requireUser(context, request);
  return null;
}

export default function Page() {
  return <PlaceholderPage title="My listings" description="Create, edit, pause and manage your listings." milestone="Milestone 6" icon="home" />;
}
