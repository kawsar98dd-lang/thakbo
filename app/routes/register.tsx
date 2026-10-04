import { data, Form, Link, redirect } from "react-router";
import type { Route } from "./+types/register";
import { TextField } from "~/components/forms/TextField";
import { SubmitButton } from "~/components/forms/SubmitButton";
import { PageContainer } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Card } from "~/components/ui/Card";
import { PATHS } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";
import { registerSchema } from "~/lib/validation/auth";
import { fieldErrors } from "~/lib/validation/common";
import { signUpWithEmail } from "~/server/auth-actions.server";
import { cloudflareContext, currentUserContext } from "~/server/context.server";

export const meta = () => buildMeta({ title: "Create account", description: "Create your THAKBO account.", noindex: true });

export function loader({ context }: Route.LoaderArgs) {
  if (context.get(currentUserContext)) throw redirect(PATHS.dashboard);
  return null;
}

/** ONE account system: the same registration is used by people who search and people who list. */
export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const parsed = registerSchema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
  });
  if (!parsed.success) return data({ errors: fieldErrors(parsed.error), message: null }, { status: 400 });

  const result = await signUpWithEmail(context.get(cloudflareContext).env, request, parsed.data);
  if (!result.ok) return data({ errors: {}, message: result.message }, { status: result.status });
  return redirect(PATHS.dashboard, { headers: result.headers });
}

export default function Register({ actionData }: Route.ComponentProps) {
  const errors: Record<string, string> = actionData?.errors ?? {};
  return (
    <PageContainer className="max-w-md">
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-sm text-slate-600">One account lets you search for places and list your own.</p>
        {actionData?.message ? <Alert tone="error">{actionData.message}</Alert> : null}
        <Form method="post" className="space-y-4">
          <TextField label="Full name" name="name" autoComplete="name" required error={errors.name} />
          <TextField label="Email" name="email" type="email" autoComplete="email" required error={errors.email} />
          <TextField label="Password" name="password" type="password" autoComplete="new-password" required hint="At least 8 characters." error={errors.password} />
          <TextField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" required error={errors.confirmPassword} />
          <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
        </Form>
        <p className="text-sm text-slate-600">
          Already have an account? <Link className="text-brand-800 underline" to={PATHS.login}>Log in</Link>
        </p>
      </Card>
    </PageContainer>
  );
}
