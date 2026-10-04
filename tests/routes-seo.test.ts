import { describe, expect, it } from "vitest";
import { pageFromRequestUrl, safeRedirectPath } from "~/lib/routes";
import { buildMeta, canonicalUrl } from "~/lib/seo";
import { slugify, uniqueSlug } from "~/lib/utils";

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
  it("canonical URL drops the query string and trailing slash", () => {
    expect(canonicalUrl("https://x.test", "/search/")).toBe("https://x.test/search");
    expect(canonicalUrl("https://x.test", "/")).toBe("https://x.test/");
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
