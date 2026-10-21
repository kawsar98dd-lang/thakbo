import { useEffect, type ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteLoaderData,
  type LinksFunction,
} from "react-router";
import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";
import { GlobalProgress } from "./components/layout/GlobalProgress";
import { ToastProvider } from "./components/ui/ToastProvider";
import { InstallAppPrompt } from "./components/ui/InstallAppPrompt";
import { RouteError } from "./components/layout/RouteError";
import { SITE } from "./lib/constants";
import { canonicalUrl } from "./lib/seo";
import type { RootLoaderData } from "./lib/types";
import { currentUserContext } from "./server/context.server";
import { originCheckMiddleware, sessionMiddleware } from "./server/middleware.server";

export const middleware: Route.MiddlewareFunction[] = [originCheckMiddleware, sessionMiddleware];

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
];

export function loader({ context }: Route.LoaderArgs): RootLoaderData {
  const user = context.get(currentUserContext);
  return {
    user: user ? { name: user.name, email: user.email } : null,
    // Always emit production canonicals, including when a request arrives on a preview hostname.
    siteOrigin: SITE.canonicalOrigin,
  };
}

function ThemeInitializer() {
  useEffect(() => {
    let theme: "light" | "dark" = "light";
    try {
      const saved = window.localStorage.getItem("thakbo-theme");
      if (saved === "light" || saved === "dark") theme = saved;
      else if (window.matchMedia("(prefers-color-scheme: dark)").matches) theme = "dark";
    } catch {
      // If storage is unavailable, use the default light theme.
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, []);
  return null;
}

export function Layout({ children }: { children: ReactNode }) {
  const root = useRouteLoaderData<RootLoaderData>("root");
  const { pathname } = useLocation();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1c655b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="THAKBO" />
        {root ? <link rel="canonical" href={canonicalUrl(root.siteOrigin, pathname)} /> : null}
        {root ? <meta property="og:url" content={canonicalUrl(root.siteOrigin, pathname)} /> : null}
        {/^(\/(?:dashboard|admin)(?:\/|$)|\/(?:login|register|forgot-password|reset-password)(?:\/|$))/.test(pathname) ? (
          <meta name="robots" content="noindex, nofollow, noarchive" />
        ) : null}
        <Meta />
        <Links />
      </head>
      <body>
        <ToastProvider>
          <ThemeInitializer />
          <InstallAppPrompt />
          <GlobalProgress />
          {children}
        </ToastProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

/** Last-resort boundary: used when the root loader or the shell itself fails. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold tracking-widest text-brand-700">{SITE.name}</p>
      <RouteError error={error} />
    </main>
  );
}
