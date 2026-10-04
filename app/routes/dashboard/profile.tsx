import type { Route } from "./+types/profile";
import { PlaceholderPage } from "~/components/layout/PlaceholderPage";
import { requireUser } from "~/server/session.server";

export function loader({ context, request }: Route.LoaderArgs) {
  requireUser(context, request);
  return null;
}

export default function Page() {
  return <PlaceholderPage title="Profile" description="Manage your name, phone and contact details." milestone="Milestone 2" icon="user" />;
}
