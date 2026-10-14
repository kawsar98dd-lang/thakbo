import type { MetaDescriptor } from "react-router";
import { SITE } from "./constants";

export interface PageMeta {
  title: string;
  description: string;
  /** Pages that must not appear in search engines (accounts, search filters, admin). */
  noindex?: boolean;
  /** Absolute, public image URL for social sharing. Omit when no suitable image exists. */
  image?: string;
  imageAlt?: string;
}

export function formatTitle(title: string): string {
  return title === SITE.name ? `${SITE.name} — ${SITE.tagline}` : `${title} | ${SITE.name}`;
}

/** Builds title/description/Open Graph tags. The canonical URL is added once, in root.tsx. */
export function buildMeta({ title, description, noindex = false, image, imageAlt }: PageMeta): MetaDescriptor[] {
  const fullTitle = formatTitle(title);
  const tags: MetaDescriptor[] = [
    { title: fullTitle },
    { name: "description", content: description },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE.name },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
  ];
  if (image) {
    tags.push({ property: "og:image", content: image });
    tags.push({ name: "twitter:image", content: image });
    if (imageAlt) tags.push({ property: "og:image:alt", content: imageAlt });
  }
  if (noindex) tags.push({ name: "robots", content: "noindex, follow" });
  return tags;
}

/** Canonical URLs never include query strings, so filter combinations are not indexed. */
export function canonicalUrl(origin: string, pathname: string): string {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return `${origin}${path}`;
}
