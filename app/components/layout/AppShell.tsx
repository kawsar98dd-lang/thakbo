import type { ReactNode } from "react";
import type { RootLoaderData } from "~/lib/types";
import { MobileTabBar } from "./MobileTabBar";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/** Header + main content + footer (+ mobile tab bar). Shared by every page and by error pages. */
export function AppShell({ user, children }: { user: RootLoaderData["user"]; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to main content
      </a>
      <SiteHeader user={user} />
      {/* Bottom padding keeps content clear of the fixed mobile tab bar. */}
      <main id="main" className="flex-1 py-6 pb-24 sm:py-8 md:pb-8">
        {children}
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
