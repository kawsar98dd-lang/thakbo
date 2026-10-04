import type { Route } from "./+types/favorites";
import { PlaceholderPage } from "~/components/layout/PlaceholderPage";
import { requireUser } from "~/server/session.server";

export function loader({ context, request }: Route.LoaderArgs) {
  requireUser(context, request);
  return null;
}

export default function Page() {
  return <PlaceholderPage title="Saved places" description="Places you saved will appear here." milestone="Milestone 5" icon="heart" />;
}
