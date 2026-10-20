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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(15,55,48,0.08)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => (
          <li key={tab.label}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cx(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                  isActive ? "text-brand-800" : "text-slate-500 hover:text-brand-800",
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
