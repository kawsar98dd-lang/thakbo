import { notFound } from "~/server/errors.server";

/** Catch-all: any unknown URL becomes a real 404 response rendered by the layout's error boundary. */
export function loader() {
  throw notFound();
}

export default function NotFoundSplat() {
  return null;
}
