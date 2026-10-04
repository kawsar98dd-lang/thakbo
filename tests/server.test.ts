import { describe, expect, it } from "vitest";
import { buildListingSearchQuery } from "~/server/db/listing-search";
import { redact } from "~/server/logger.server";
import { buildListingImageKey, sniffImageType, validateImageBytes } from "~/server/storage/media.server";
import { parseSearchParams } from "~/lib/validation/search";

const build = (query: string) => buildListingSearchQuery(parseSearchParams(new URLSearchParams(query)));

describe("listing search SQL builder", () => {
  it("always restricts to published listings and paginates", () => {
    const { sql, params } = build("");
    expect(sql).toContain("l.status = 'published'");
    expect(params.slice(-2)).toEqual([21, 0]); // pageSize + 1, offset 0
  });
  it("binds user input as parameters and never places it in the SQL text", () => {
    const evil = "rajshahi'; DROP TABLE listings;--";
    const { sql, params } = buildListingSearchQuery({ ...parseSearchParams(new URLSearchParams("")), city: evil });
    expect(sql).not.toContain("DROP TABLE");
    expect(params).toContain(evil);
  });
  it("counts placeholders correctly for every filter combination", () => {
    const { sql, params } = build(
      "city=rajshahi&area=talaimari&type=mess,room&audience=student&facility=wifi,meal&min_price=1000&max_price=5000&available=now&lat=24.37&lng=88.6&radius=3&page=3",
    );
    expect((sql.match(/\?/g) ?? []).length).toBe(params.length);
    expect(params.slice(-2)).toEqual([21, 40]);
  });
  it("uses a fixed ORDER BY for each sort option", () => {
    expect(build("sort=price_asc").sql).toContain("ORDER BY l.rent_amount ASC");
    expect(build("sort=nonsense").sql).toContain("ORDER BY l.published_at DESC");
  });
});

describe("image validation", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  it("detects real types from bytes", () => {
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
  });
  it("rejects a script renamed to .jpg", () => {
    expect(validateImageBytes(new TextEncoder().encode("<script>alert(1)</script>")).ok).toBe(false);
  });
  it("rejects empty and oversized files", () => {
    expect(validateImageBytes(new Uint8Array()).ok).toBe(false);
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(jpeg);
    expect(validateImageBytes(big).ok).toBe(false);
  });
  it("builds keys without user-provided names", () => {
    expect(buildListingImageKey("abc", "image/png", "r1")).toBe("listings/abc/r1.png");
  });
});

describe("logger redaction", () => {
  it("hides secrets at any depth", () => {
    const out = redact({ user: "a", password: "p", nested: { sessionToken: "t", Authorization: "x", ok: 1 } }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toMatch(/"p"|"t"|"x"/);
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
  });
});
