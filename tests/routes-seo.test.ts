import { describe, expect, it } from "vitest";
import { pageFromRequestUrl, safeRedirectPath } from "~/lib/routes";
import { SITE } from "~/lib/constants";
import { buildMeta, canonicalUrl } from "~/lib/seo";
import { slugify, uniqueSlug } from "~/lib/utils";
import { loader as robotsLoader } from "~/routes/seo/robots";
import { serializeJsonLd } from "~/components/seo/Breadcrumbs";

describe("safeRedirectPath", () => {
  it("allows local paths", () => expect(safeRedirectPath("/dashboard/listings")).toBe("/dashboard/listings"));
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", ""])("rejects %s", (value) => {
    expect(safeRedirectPath(value)).toBe("/dashboard");
  });
  it("uses the fallback for null", () => expect(safeRedirectPath(null, "/x")).toBe("/x"));
});

describe("pageFromRequestUrl", () => {
  it("strips React Router data-request details", () => {
    expect(pageFromRequestUrl("https://x.test/dashboard.data?_routes=a")).toBe("/dashboard");
    expect(pageFromRequestUrl("https://x.test/_.data")).toBe("/");
    expect(pageFromRequestUrl("https://x.test/search?city=a")).toBe("/search?city=a");
  });
});

describe("seo", () => {
  it("uses one configured production origin for canonical URLs", () => {
    expect(SITE.canonicalOrigin).toBe("https://thakbo.eu.cc");
    expect(canonicalUrl(SITE.canonicalOrigin, "/city/rajshahi")).toBe("https://thakbo.eu.cc/city/rajshahi");
  });
  it("uses the THAKBO launch domain and bilingual metadata without duplicate brand suffix", () => {
    expect(SITE.canonicalOrigin).toBe("https://thakbo.eu.cc");
    expect(buildMeta({ title: "THAKBO (থাকবো) | বাংলাদেশে বাসা, রুম ও মেস ভাড়া খুঁজুন", description: "বাংলাদেশে বাসা ভাড়া" }))
      .toContainEqual({ title: "THAKBO (থাকবো) | বাংলাদেশে বাসা, রুম ও মেস ভাড়া খুঁজুন" });
    expect(buildMeta({ title: "T", description: "D" })).toContainEqual({ property: "og:locale", content: "bn_BD" });
  });
  it("canonical URL drops the query string and trailing slash", () => {
    expect(canonicalUrl("https://x.test", "/search/")).toBe("https://x.test/search");
    expect(canonicalUrl("https://x.test", "/")).toBe("https://x.test/");
  });
  it("lets crawlers reach noindex account pages and advertises the canonical sitemap", async () => {
    const response = robotsLoader();
    const body = await response.text();
    expect(body).toContain(`Sitemap: ${SITE.canonicalOrigin}/sitemap.xml`);
    expect(body).toContain("Disallow: /api/");
    expect(body).not.toContain("Disallow: /dashboard");
    expect(body).not.toContain("Disallow: /admin");
    expect(body).not.toContain("Disallow: /login");
    expect(body).not.toContain("Disallow: /register");
  });
  it("adds social image metadata only when a public image is supplied", () => {
    const withoutImage = buildMeta({ title: "T", description: "D" });
    expect(withoutImage.some((tag) => "property" in tag && tag.property === "og:image")).toBe(false);
    const withImage = buildMeta({ title: "T", description: "D", image: "https://example.test/photo.webp", imageAlt: "Room photo" });
    expect(withImage).toContainEqual({ property: "og:image", content: "https://example.test/photo.webp" });
    expect(withImage).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
    expect(withImage).toContainEqual({ property: "og:image:alt", content: "Room photo" });
  });
  it("serializes JSON-LD safely for HTML script context", () => {
    const result = serializeJsonLd({ name: "</script><script>alert(1)</script>", separator: "A & B" });
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c/script\\u003e");
    expect(result).toContain("A \\u0026 B");
  });
  it("adds noindex only when requested", () => {
    const names = (noindex: boolean) =>
      buildMeta({ title: "T", description: "D", noindex }).some((t) => "name" in t && t.name === "robots");
    expect(names(true)).toBe(true);
    expect(names(false)).toBe(false);
  });
});

describe("slugs", () => {
  it("slugifies", () => expect(slugify("  Comfortable Student Mess — Talaimari! ")).toBe("comfortable-student-mess-talaimari"));
  it("never returns an empty slug", () => expect(uniqueSlug("???", "ab12")).toBe("listing-ab12"));
});
