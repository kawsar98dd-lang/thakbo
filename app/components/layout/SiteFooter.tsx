import { Link } from "react-router";
import { SITE } from "~/lib/constants";
import { PATHS } from "~/lib/routes";
import { PageContainer } from "./PageContainer";

const FOOTER_LINKS = [
  { to: PATHS.about, label: "About" },
  { to: PATHS.howItWorks, label: "How it works" },
  { to: PATHS.contact, label: "Contact" },
  { to: PATHS.privacy, label: "Privacy" },
  { to: PATHS.terms, label: "Terms" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <PageContainer className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold tracking-wider text-brand-800">
            {SITE.name} <span lang="bn" className="font-semibold tracking-normal">({SITE.nameBn})</span>
          </p>
          <p className="text-sm text-slate-600">{SITE.tagline}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {FOOTER_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="inline-flex min-h-11 items-center text-slate-700 hover:text-brand-800 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </PageContainer>
    </footer>
  );
}
