import { Form, Link, NavLink } from "react-router";
import { Button, ButtonLink } from "~/components/ui/Button";
import { SITE } from "~/lib/constants";
import { PATHS } from "~/lib/routes";
import { cx } from "~/lib/utils";
import type { RootLoaderData } from "~/lib/types";
import { Icon } from "../ui/Icon";

// Desktop navigation (blueprint: Home, Search, Explore, List a Place, Favorites, Profile).
// "Explore" jumps to the browse sections of the home page.
const DESKTOP_LINKS = [
  { to: PATHS.home, label: "Home", end: true },
  { to: PATHS.search, label: "Search", end: false },
  { to: `${PATHS.home}#explore`, label: "Explore", end: false, anchor: true },
  { to: PATHS.favorites, label: "Favorites", end: false },
  { to: PATHS.profile, label: "Profile", end: false },
] as const;

const linkClass = "rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900";

export function SiteHeader({ user }: { user: RootLoaderData["user"] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to={PATHS.home} className="flex min-h-11 items-center gap-2 font-bold tracking-wider text-brand-800" aria-label={`${SITE.name} home`}>
          <span className="grid size-8 place-items-center rounded-lg bg-brand-700 text-white">
            <Icon name="pin" className="size-5" />
          </span>
          <span className="text-lg">{SITE.name}</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {DESKTOP_LINKS.map((item) =>
            "anchor" in item ? (
              <a key={item.label} href={item.to} className={linkClass}>
                {item.label}
              </a>
            ) : (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cx(linkClass, isActive && "bg-brand-50 text-brand-900")}
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <ButtonLink to={PATHS.newListing} size="md" className="px-3 sm:px-4">
            <Icon name="plus" className="size-4" />
            <span>List a Place</span>
          </ButtonLink>
          {user ? (
            <Form method="post" action={PATHS.logout} className="hidden md:block">
              <Button type="submit" variant="secondary">
                Log out
              </Button>
            </Form>
          ) : (
            <ButtonLink to={PATHS.login} variant="secondary" className="hidden md:inline-flex">
              Log in
            </ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}
