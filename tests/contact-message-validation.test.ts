import { describe, expect, it } from "vitest";
import { contactMessageSchema, validateContactMessage } from "~/lib/validation/contact-message";

const valid = { name: "Kawsar Ahmed", email: "USER@Example.com", subject: "Question about a listing", message: "Please help me with a listing on THAKBO." };

describe("contact message validation", () => {
  it("trims fields and normalizes email", () => {
    const result = validateContactMessage({ ...valid, name: "  Kawsar Ahmed  ", email: " USER@Example.com " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ name: "Kawsar Ahmed", email: "user@example.com" });
  });

  it("rejects malformed email and reports a safe user-facing message", () => {
    const result = validateContactMessage({ ...valid, email: "not-an-email" });
    expect(result).toEqual({ success: false, message: "Enter a valid email address." });
  });

  it.each([
    ["short name", { ...valid, name: "A" }],
    ["long name", { ...valid, name: "N".repeat(101) }],
    ["short subject", { ...valid, subject: "Hi" }],
    ["long subject", { ...valid, subject: "S".repeat(161) }],
    ["short message", { ...valid, message: "Too short" }],
    ["long message", { ...valid, message: "M".repeat(3001) }],
  ])("rejects %s", (_label, input) => {
    expect(contactMessageSchema.safeParse(input).success).toBe(false);
  });

  it("does not accept extra fields such as database status or admin flags", () => {
    expect(contactMessageSchema.safeParse({ ...valid, status: "read", isAdmin: true }).success).toBe(false);
  });

  it("accepts the documented maximum lengths", () => {
    expect(contactMessageSchema.safeParse({ name: "N".repeat(100), email: "a@example.com", subject: "S".repeat(160), message: "M".repeat(3000) }).success).toBe(true);
  });
});
