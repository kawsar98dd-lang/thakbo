import { useState } from "react";
import { data, Form } from "react-router";
import type { Route } from "./+types/contact";
import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { TextField } from "~/components/forms/TextField";
import { TextAreaField } from "~/components/forms/TextAreaField";
import { buildMeta } from "~/lib/seo";
import { validateContactMessage } from "~/lib/validation/contact-message";
import { cloudflareContext } from "~/server/context.server";
import { execute, queryFirst } from "~/server/db/client";

export const meta = () => buildMeta({ title: "Contact", description: "Contact the THAKBO team about your account, listing or experience." });

type FormState = { ok: boolean; message: string; values?: { name: string; email: string; subject: string; message: string } };

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const raw = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const submitted = { name: raw("name"), email: raw("email"), subject: raw("subject"), message: raw("message") };
  // Honeypot: silently accept bot submissions without storing or revealing the field.
  if (raw("website")) return data({ ok: true, message: "Thank you. Your message has been received." });
  const validation = validateContactMessage(submitted);
  if (!validation.success) return data({ ok: false, message: validation.message, values: submitted }, { status: 400 });
  const values = validation.data;

  const { env } = context.get(cloudflareContext);
  // A simple per-email cooldown helps prevent accidental repeated submissions. This is not a substitute for edge-level abuse controls.
  try {
    const recent = await queryFirst<{ id: string }>(env.DB,
      "SELECT id FROM contact_messages WHERE email = ? AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-10 minutes') LIMIT 1",
      [values.email],
    );
    if (recent) return data({ ok: false, message: "A recent message from this email is already in our inbox. Please wait 10 minutes before sending another." }, { status: 429 });

    await execute(env.DB,
      "INSERT INTO contact_messages (id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), values.name, values.email, values.subject, values.message],
    );
  } catch {
    // The code may be deployed before migration 0009 is approved/applied. Do not expose database details.
    return data({ ok: false, message: "The contact form is temporarily unavailable while setup is completed. Please try again later." }, { status: 503 });
  }
  return data({ ok: true, message: "Thank you. Your message has been received by the THAKBO team." });
}

export default function ContactPage({ actionData }: Route.ComponentProps) {
  const [resetKey, setResetKey] = useState(0);
  const result = actionData as FormState | undefined;
  return (
    <PageContainer>
      <PageHeader title="Contact" description="Send the THAKBO team a message about your account, a listing or your experience." />
      <div className="max-w-2xl space-y-4">
        <p className="text-slate-700">Messages are saved securely for the team to review. Do not include passwords, payment details or other sensitive information.</p>
        {result ? <Alert tone={result.ok ? "success" : "error"}>{result.message}</Alert> : null}
        <Form key={resetKey} method="post" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <TextField name="name" label="Your name" autoComplete="name" required minLength={2} maxLength={100} defaultValue={result?.values?.name ?? ""} />
          <TextField name="email" label="Email address" type="email" autoComplete="email" required maxLength={254} defaultValue={result?.values?.email ?? ""} />
          <TextField name="subject" label="Subject" required minLength={3} maxLength={160} defaultValue={result?.values?.subject ?? ""} />
          <TextAreaField name="message" label="Message" required minLength={10} maxLength={3000} rows={6} defaultValue={result?.values?.message ?? ""} />
          <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"><label htmlFor="contact-website">Leave this field empty</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off" /></div>
          <Button type="submit" size="lg" className="w-full">Send message</Button>
          {result?.ok ? <button type="button" className="text-sm font-semibold text-brand-800 underline" onClick={() => setResetKey((key) => key + 1)}>Send another message</button> : null}
        </Form>
      </div>
    </PageContainer>
  );
}
