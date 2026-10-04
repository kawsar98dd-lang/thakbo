import { isRouteErrorResponse } from "react-router";
import { PATHS } from "~/lib/routes";
import { ButtonLink } from "~/components/ui/Button";
import { Icon } from "~/components/ui/Icon";

interface ErrorCopy {
  title: string;
  message: string;
}

const COPY: Record<number, ErrorCopy> = {
  401: { title: "Please log in", message: "You need to be logged in to see this page." },
  403: { title: "Access denied", message: "You do not have permission to view this page." },
  404: { title: "Page not found", message: "The page you are looking for does not exist or has moved." },
};

const FALLBACK: ErrorCopy = {
  title: "Something went wrong",
  message: "We had a problem on our side. Please try again in a moment.",
};

export function errorStatus(error: unknown): number {
  return isRouteErrorResponse(error) ? error.status : 500;
}

/** Friendly error display. Raw error details are never shown to visitors in production. */
export function ErrorState({ status, className }: { status: number; className?: string }) {
  const copy = COPY[status] ?? FALLBACK;
  return (
    <div className={className ?? "mx-auto max-w-xl px-4 py-12 text-center"}>
      <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-red-50 text-red-700">
        <Icon name="alert" className="size-7" />
      </span>
      <p className="text-sm font-semibold text-slate-600">Error {status}</p>
      <h1 className="mt-1 text-2xl font-bold">{copy.title}</h1>
      <p className="mt-2 text-slate-600">{copy.message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink to={PATHS.home}>Go to home page</ButtonLink>
        {status === 401 ? <ButtonLink to={PATHS.login} variant="secondary">Log in</ButtonLink> : null}
      </div>
    </div>
  );
}

export function RouteError({ error }: { error: unknown }) {
  const status = errorStatus(error);
  return (
    <>
      <ErrorState status={status} />
      {import.meta.env.DEV && error instanceof Error ? (
        <p className="mx-auto max-w-xl px-4 pb-8 text-center font-mono text-xs text-slate-500">Dev only: {error.message}</p>
      ) : null}
    </>
  );
}
