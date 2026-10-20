import { data, Form, Link, redirect, useLocation } from "react-router";
import type { Route } from "./+types/reset-password";
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

export const meta = () => buildMeta({ title: "Reset password", description: "Choose a new password for your THAKBO account.", noindex: true });
const schema = z.object({ token: z.string().min(1).max(2048), password: z.string().min(8).max(128), confirmPassword: z.string() }).refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const parsed = schema.safeParse({ token: form.get("token"), password: form.get("password"), confirmPassword: form.get("confirmPassword") });
  if (!parsed.success) return data({ success: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." }, { status: 400 });
  const { env } = context.get(cloudflareContext);
  try {
    const result = await getAuth(env).api.resetPassword({ body: { token: parsed.data.token, newPassword: parsed.data.password } });
    if (result) return redirect(`${PATHS.login}?passwordReset=success`);
    return data({ success: false, message: "This reset link may have expired or already been used. Request a new one." }, { status: 400 });
  } catch (error) {
    logger.warn("password reset completion failed");
    return data({ success: false, message: "This reset link is invalid, expired, or already used. Request a new link and try again." }, { status: 400 });
  }
}

export default function Page({ actionData }: Route.ComponentProps) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const token = params.get("token") ?? "";
  const invalid = params.get("error") === "INVALID_TOKEN" || !token;
  return (
    <PageContainer className="max-w-md">
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold">Reset password</h1>
        {invalid ? <Alert tone="error">This reset link is missing or invalid. Request a new password reset link.</Alert> : null}
        {actionData?.message ? <Alert tone={actionData.success ? "success" : "error"}>{actionData.message}</Alert> : null}
        {!invalid && !actionData?.success ? <Form method="post" className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <TextField label="New password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
          <TextField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
          <SubmitButton pendingText="Updating password…">Set new password</SubmitButton>
        </Form> : null}
        <Link className="text-sm text-brand-800 underline" to={PATHS.forgotPassword}>Request another reset link</Link>
      </Card>
    </PageContainer>
  );
}
