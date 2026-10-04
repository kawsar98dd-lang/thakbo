import { data, Form, Link, redirect } from "react-router";
import type { Route } from "./+types/login";
import { TextField } from "~/components/forms/TextField";
import { SubmitButton } from "~/components/forms/SubmitButton";
import { PageContainer } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Card } from "~/components/ui/Card";
import { PATHS, safeRedirectPath } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { fieldErrors } from "~/lib/validation/common";
import { loginSchema } from "~/lib/validation/auth";
import { signInWithEmail } from "~/server/auth-actions.server";
import { cloudflareContext, currentUserContext } from "~/server/context.server";

export const meta = () => buildMeta({ title: "Log in", description: "Log in to your THAKBO account.", noindex: true });

export function loader({ context, request }: Route.LoaderArgs) {
  const redirectTo = safeRedirectPath(new URL(request.url).searchParams.get("redirectTo"));
  if (context.get(currentUserContext)) throw redirect(redirectTo);
  return { redirectTo };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return data({ errors: fieldErrors(parsed.error), message: null }, { status: 400 });

  const result = await signInWithEmail(context.get(cloudflareContext).env, request, parsed.data);
  if (!result.ok) return data({ errors: {}, message: result.message }, { status: result.status });

  const redirectTo = safeRedirectPath(String(form.get("redirectTo") ?? ""));
  return redirect(redirectTo, { headers: result.headers });
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const errors: Record<string, string> = actionData?.errors ?? {};
  return (
    <PageContainer className="max-w-md">
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold">Log in</h1>
        {actionData?.message ? <Alert tone="error">{actionData.message}</Alert> : null}
        <Form method="post" className="space-y-4">
          <input type="hidden" name="redirectTo" value={loaderData.redirectTo} />
          <TextField label="Email" name="email" type="email" autoComplete="email" required error={errors.email} />
          <TextField label="Password" name="password" type="password" autoComplete="current-password" required error={errors.password} />
          <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
        </Form>
        <p className="text-sm text-slate-600">
          <Link className="text-brand-800 underline" to={PATHS.forgotPassword}>Forgot password?</Link>
          {" · "}
          <Link className="text-brand-800 underline" to={PATHS.register}>Create an account</Link>
        </p>
      </Card>
    </PageContainer>
  );
}
