import { describe, expect, it } from "vitest";
import { fieldErrors } from "~/lib/validation/common";
import { formToObject } from "~/lib/validation/form";
import { PROFILE_FIELDS, profileInputSchema } from "~/lib/validation/profile";

describe("profile validation", () => {
  it("accepts a valid profile and trims text", () => {
    const result = profileInputSchema.safeParse({ displayName: "  Rahim Uddin ", phone: "+8801712345678", whatsapp: "01712-345678", bio: " Student ", preferredCityId: "1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ displayName: "Rahim Uddin", phone: "+8801712345678", bio: "Student", preferredCityId: 1 });
    }
  });

  it("treats blank optional fields as missing (not as 0 or an empty string)", () => {
    const result = profileInputSchema.safeParse({ displayName: "Rahim", phone: "", whatsapp: "  ", bio: "", preferredCityId: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeUndefined();
      expect(result.data.preferredCityId).toBeUndefined();
    }
  });

  it("rejects short names, bad phone numbers, long bios and bad city ids", () => {
    expect(profileInputSchema.safeParse({ displayName: "R" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ displayName: "Rahim", phone: "abc" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ displayName: "Rahim", whatsapp: "12" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ displayName: "Rahim", bio: "x".repeat(501) }).success).toBe(false);
    expect(profileInputSchema.safeParse({ displayName: "Rahim", preferredCityId: "-3" }).success).toBe(false);
    const bad = profileInputSchema.safeParse({ displayName: "Rahim", phone: "abc" });
    if (!bad.success) expect(fieldErrors(bad.error).phone).toContain("valid phone");
  });

  it("never lets a client set user_id, avatar or roles (mass assignment)", () => {
    const form = new FormData();
    form.set("displayName", "Rahim");
    form.set("userId", "someone-else");
    form.set("user_id", "someone-else");
    form.set("avatarUrl", "http://evil.test/x.png");
    form.set("role", "admin");
    const object = formToObject(form, PROFILE_FIELDS);
    expect(Object.keys(object).sort()).toEqual([...PROFILE_FIELDS].sort());
    const parsed = profileInputSchema.parse(object);
    expect(Object.keys(parsed)).not.toContain("userId");
    expect(Object.keys(parsed)).not.toContain("role");
    expect(Object.keys(parsed)).not.toContain("avatarUrl");
  });
});
