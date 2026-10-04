import { data } from "react-router";
import { ErrorState } from "~/components/layout/RouteError";
import { buildMeta } from "~/lib/seo";

export const meta = () => buildMeta({ title: "Something went wrong", description: "Error 500", noindex: true });

export function loader() {
  return data(null, { status: 500 });
}

export default function ErrorPage() {
  return <ErrorState status={500} />;
}
