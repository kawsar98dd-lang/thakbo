import { data, Form, Link } from "react-router";
import type { Route } from "./+types/forgot-password";
import { z } from "zod";
import { TextField } from "~/components/forms/TextField";
import { SubmitButton } from "~/components/forms/SubmitButton";
import { PageContainer } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Card } from "~/components/ui/Card";
import { PATHS } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { cloudflareContext } from "~/server/context.server";
import { getAuth } from "~/server/auth.server";
import { logger } from "~/server/logger.server";

export const meta = () => buildMeta({ title: "Forgot password", description: "Reset your THAKBO account password.", noindex: true });
const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const parsed = schema.safeParse({ email: form.get("email") });
  if (!parsed.success) return data({ success: false, message: "Enter a valid email address." }, { status: 400 });
  const { env } = context.get(cloudflareContext);
  if (!env.RESEND_API_KEY) {
    logger.error("password reset requested but RESEND_API_KEY is not configured");
    return data({ success: false, message: "Password reset is temporarily unavailable. Please try again later." }, { status: 503 });
  }
  try {
    const origin = new URL(request.url).origin;
    await getAuth(env).api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: `${origin}${PATHS.resetPassword}` },
      headers: request.headers,
    });
  } catch (error) {
    // Avoid revealing whether an account exists or logging user/reset-token data.
    logger.error("password reset request failed", { error });
  }
  return data({ success: true, message: "If an account exists for that email, a password reset link will be sent shortly. Check your inbox and spam folder." });
}

export default function Page({ actionData }: Route.ComponentProps) {
  return (
    <PageContainer className="max-w-md">
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold">Forgot password</h1>
        <p className="text-sm text-slate-600">Enter the email address associated with your THAKBO account. We will send a reset link if an account matches.</p>
        {actionData?.message ? <Alert tone={actionData.success ? "success" : "error"}>{actionData.message}</Alert> : null}
        <Form method="post" className="space-y-4">
          <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <SubmitButton pendingText="Sending link…">Send reset link</SubmitButton>
        </Form>
        <Link className="text-sm text-brand-800 underline" to={PATHS.login}>Back to log in</Link>
      </Card>
    </PageContainer>
  );
}
