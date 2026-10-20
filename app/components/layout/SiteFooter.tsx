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
    <footer className="mt-16 border-t border-slate-200/80 bg-white pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      <PageContainer className="flex flex-col gap-5 py-9 sm:flex-row sm:items-center sm:justify-between lg:py-10">
        <div>
          <p className="font-extrabold tracking-tight text-brand-800">
            {SITE.name} <span lang="bn" className="font-semibold tracking-normal">({SITE.nameBn})</span>
          </p>
          <p className="text-sm text-slate-600">{SITE.tagline}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm sm:gap-x-5">
            {FOOTER_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="inline-flex min-h-11 items-center rounded-lg px-2 text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-800">
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
