import { describe, expect, it } from "vitest";
import { normalizeReportText } from "../app/lib/report-text";

describe("normalizeReportText", () => {
  it("trims surrounding whitespace while preserving readable new lines", () => {
    expect(normalizeReportText("  fake listing\r\nowner unavailable  ")).toBe("fake listing\nowner unavailable");
  });
  it("removes null bytes and unsafe control characters", () => {
    expect(normalizeReportText("fake\u0000 listing\u0007")).toBe("fake listing");
  });
  it("does not remove normal Bangla or Unicode text", () => {
    expect(normalizeReportText("  ভুয়া বিজ্ঞাপন — পরীক্ষা  ")).toBe("ভুয়া বিজ্ঞাপন — পরীক্ষা");
  });
});
