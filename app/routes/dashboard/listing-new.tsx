import type { Route } from "./+types/listing-new";
import { PlaceholderPage } from "~/components/layout/PlaceholderPage";
import { requireUser } from "~/server/session.server";

export function loader({ context, request }: Route.LoaderArgs) {
  requireUser(context, request);
  return null;
}

export default function Page() {
  return <PlaceholderPage title="List a place" description="A simple step-by-step form to list your place." milestone="Milestone 3" icon="plus" />;
}
