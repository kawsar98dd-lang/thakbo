import { logger } from "./logger.server";
import type { AppEnv } from "./env.server";

/** Sends a transactional email through Resend. API credentials remain server-side. */
export async function sendResendEmail(
  env: AppEnv,
  message: { to: string; subject: string; text: string; html?: string },
): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured.");
  const from = env.RESEND_FROM_EMAIL || "THAKBO <noreply@trustedtoolsweb.com>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, ...(message.html ? { html: message.html } : {}) }),
  });
  if (!response.ok) {
    // Do not log recipient, API key, reset URL, or response body (which can contain sensitive details).
    logger.error("Resend email request failed", { status: response.status });
    throw new Error(`Resend request failed with status ${response.status}.`);
  }
}
