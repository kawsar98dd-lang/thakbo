import { NavLink } from "react-router";
import { cx } from "~/lib/utils";

/** Horizontal tab-style navigation used inside the dashboard and admin areas. Scrolls on small screens. */
export function SubNav({ label, items }: { label: string; items: ReadonlyArray<{ to: string; label: string; end?: boolean }> }) {
  return (
    <nav aria-label={label} className="mb-6 overflow-x-auto border-b border-slate-200">
      <ul className="flex min-w-max gap-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  "inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium",
                  isActive ? "border-brand-700 text-brand-900" : "border-transparent text-slate-600 hover:text-slate-900",
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
