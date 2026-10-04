import { data } from "react-router";
import { ErrorState } from "~/components/layout/RouteError";
import { buildMeta } from "~/lib/seo";

export const meta = () => buildMeta({ title: "Access denied", description: "Error 403", noindex: true });

export function loader() {
  return data(null, { status: 403 });
}

export default function ErrorPage() {
  return <ErrorState status={403} />;
}
