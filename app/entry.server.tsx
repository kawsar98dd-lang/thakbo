import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { ServerRouter, type EntryContext, type HandleErrorFunction } from "react-router";
import { logger } from "./server/logger.server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  let status = responseStatusCode;
  const body = await renderToReadableStream(<ServerRouter context={routerContext} url={request.url} />, {
    onError(error: unknown) {
      status = 500;
      logger.error("render error", { error });
    },
    signal: request.signal,
  });

  // Crawlers get the fully rendered page (important for SEO).
  if (isbot(request.headers.get("user-agent") ?? "")) await body.allReady;

  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, { headers: responseHeaders, status });
}

/** Logs unexpected server errors. Users only ever see the friendly error page. */
export const handleError: HandleErrorFunction = (error, { request }) => {
  if (request.signal.aborted) return;
  logger.error("unhandled request error", { method: request.method, url: new URL(request.url).pathname, error });
};
