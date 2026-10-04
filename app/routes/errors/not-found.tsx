import { data } from "react-router";
import { ErrorState } from "~/components/layout/RouteError";
import { buildMeta } from "~/lib/seo";

export const meta = () => buildMeta({ title: "Page not found", description: "Error 404", noindex: true });

export function loader() {
  return data(null, { status: 404 });
}

export default function ErrorPage() {
  return <ErrorState status={404} />;
}
