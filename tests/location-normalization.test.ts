import { describe, expect, it } from "vitest";
import {
  containsBangla,
  detectAliasLanguage,
  escapeLike,
  formatLocationLabel,
  localizedName,
  normalizeLocationText,
} from "~/lib/location";

describe("normalizeLocationText", () => {
  it("ignores case, spacing, punctuation and hyphens", () => {
    const key = normalizeLocationText("Hetem Khan");
    expect(key).toBe("hetemkhan");
    expect(normalizeLocationText("  HETEM   khan ")).toBe(key);
    expect(normalizeLocationText("hetem-khan")).toBe(key);
    expect(normalizeLocationText("Hetem. Khan!")).toBe(key);
  });

  it("treats spaced and unspaced Bangla names as the same place", () => {
    expect(normalizeLocationText("সাহেব বাজার")).toBe(normalizeLocationText("সাহেববাজার"));
    expect(normalizeLocationText("হেতেম খান")).toBe("হেতেমখান");
  });

  it("removes invisible joiner characters inside Bangla text", () => {
    expect(normalizeLocationText("হেতেম\u200c খান")).toBe(normalizeLocationText("হেতেম খান"));
  });

  it("strips Latin accents and collapses doubled Latin letters", () => {
    expect(normalizeLocationText("Shahéb Bazaar")).toBe(normalizeLocationText("Shaheb Bazar"));
  });

  it("does NOT merge different spellings: that is the alias table's job", () => {
    expect(normalizeLocationText("Hatem Khan")).not.toBe(normalizeLocationText("Hetem Khan"));
    expect(normalizeLocationText("Saheb Bazar")).not.toBe(normalizeLocationText("Shaheb Bazar"));
  });

  it("does NOT transliterate between scripts", () => {
    expect(normalizeLocationText("হেতেম খান")).not.toBe(normalizeLocationText("Hetem Khan"));
  });

  it("returns an empty string when nothing comparable is left", () => {
    expect(normalizeLocationText("  -- ")).toBe("");
    expect(normalizeLocationText("")).toBe("");
  });

  it("is idempotent", () => {
    for (const text of ["Shaheb Bazar", "সাহেব বাজার", "Hetem-Khan"]) {
      expect(normalizeLocationText(normalizeLocationText(text))).toBe(normalizeLocationText(text));
    }
  });
});

describe("language and labels", () => {
  it("detects Bangla, English and mixed text", () => {
    expect(containsBangla("হেতেম")).toBe(true);
    expect(containsBangla("Hetem")).toBe(false);
    expect(detectAliasLanguage("হেতেম খান")).toBe("bn");
    expect(detectAliasLanguage("Hetem Khan")).toBe("en");
    expect(detectAliasLanguage("Hetem খান")).toBe("mixed");
  });

  const area = { name: "Hetem Khan", nameEn: "Hetem Khan", nameBn: "হেতেম খান" };
  const city = { name: "Rajshahi", nameEn: "Rajshahi", nameBn: "রাজশাহী" };

  it("formats public location labels in English and Bangla without ids", () => {
    expect(formatLocationLabel(area, city, "en")).toBe("Hetem Khan, Rajshahi");
    expect(formatLocationLabel(area, city, "bn")).toBe("হেতেম খান, রাজশাহী");
  });

  it("falls back to English when no Bangla name exists", () => {
    expect(localizedName({ name: "Kazla", nameEn: null, nameBn: null }, "bn")).toBe("Kazla");
  });

  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
