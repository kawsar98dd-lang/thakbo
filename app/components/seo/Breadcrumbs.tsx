import { Link } from "react-router";
import { SITE } from "~/lib/constants";

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

/**
 * Render visible breadcrumbs and matching Schema.org BreadcrumbList JSON-LD.
 * JSON is escaped for HTML script context so user-provided listing titles cannot
 * terminate the script element.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/* eslint-disable no-restricted-syntax -- The JSON-LD script below uses safely serialized schema data. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length < 2) return null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.path ? { item: `${SITE.canonicalOrigin}${item.path}` } : {}),
    })),
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-600">
        <ol className="flex flex-wrap items-center gap-2">
          {items.map((item, index) => (
            <li key={`${item.path ?? "current"}:${index}`} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {index === items.length - 1 || !item.path ? (
                <span aria-current={index === items.length - 1 ? "page" : undefined}>{item.label}</span>
              ) : (
                <Link className="underline underline-offset-2 hover:text-brand-800" to={item.path}>{item.label}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
    </>
  );
}
/* eslint-enable no-restricted-syntax */
