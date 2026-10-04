import { NavLink } from "react-router";
import { PATHS } from "~/lib/routes";
import { cx } from "~/lib/utils";
import { Icon, type IconName } from "../ui/Icon";

// Mobile navigation (blueprint: Home, Search, Saved, Profile).
const TABS: ReadonlyArray<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: PATHS.home, label: "Home", icon: "home", end: true },
  { to: PATHS.search, label: "Search", icon: "search" },
  { to: PATHS.favorites, label: "Saved", icon: "heart" },
  { to: PATHS.profile, label: "Profile", icon: "user" },
];

export function MobileTabBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => (
          <li key={tab.label}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cx(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  isActive ? "text-brand-800" : "text-slate-600",
                )
              }
            >
              <Icon name={tab.icon} className="size-6" />
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
