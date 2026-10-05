import { data, Form } from "react-router";
import type { Route } from "./+types/profile";
import { SelectField } from "~/components/forms/SelectField";
import { SubmitButton } from "~/components/forms/SubmitButton";
import { TextAreaField } from "~/components/forms/TextAreaField";
import { TextField } from "~/components/forms/TextField";
import { PageHeader } from "~/components/layout/PageContainer";
import { Alert } from "~/components/ui/Alert";
import { Card } from "~/components/ui/Card";
import { buildMeta } from "~/lib/seo";
import { fieldErrors } from "~/lib/validation/common";
import { formStrings, formToObject } from "~/lib/validation/form";
import { PROFILE_FIELDS, profileInputSchema } from "~/lib/validation/profile";
import { cloudflareContext } from "~/server/context.server";
import { ensureProfile, getProfile, updateProfile } from "~/server/db/repositories/profiles";
import { isActiveCity, listActiveCities } from "~/server/db/repositories/locations";
import { requireUser } from "~/server/session.server";

export const meta = () => buildMeta({ title: "My profile", description: "Manage your THAKBO profile.", noindex: true });

interface ProfileActionData {
  saved: boolean;
  errors: Record<string, string>;
  values: Record<string, string> | null;
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = requireUser(context, request);
  const { env } = context.get(cloudflareContext);
  // Accounts created before the profile hook existed (or if it failed) get their profile here.
  await ensureProfile(env.DB, user.id, user.name);
  const [profile, cities] = await Promise.all([getProfile(env.DB, user.id), listActiveCities(env.DB)]);
  if (!profile) throw new Error("Profile could not be loaded.");
  return { profile, cities, email: user.email };
}

/** The profile that is updated is ALWAYS the session user's: no id is read from the request. */
export async function action({ context, request }: Route.ActionArgs) {
  const user = requireUser(context, request);
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();

  const parsed = profileInputSchema.safeParse(formToObject(form, PROFILE_FIELDS));
  if (!parsed.success) {
    return data<ProfileActionData>({ saved: false, errors: fieldErrors(parsed.error), values: formStrings(form, PROFILE_FIELDS) }, { status: 400 });
  }

  const { preferredCityId, ...rest } = parsed.data;
  if (preferredCityId !== undefined && !(await isActiveCity(env.DB, preferredCityId))) {
    return data<ProfileActionData>({ saved: false, errors: { preferredCityId: "Choose a city from the list." }, values: formStrings(form, PROFILE_FIELDS) }, { status: 400 });
  }

  await ensureProfile(env.DB, user.id, user.name);
  await updateProfile(env.DB, user.id, {
    displayName: rest.displayName,
    phone: rest.phone ?? null,
    whatsapp: rest.whatsapp ?? null,
    bio: rest.bio ?? null,
    preferredCityId: preferredCityId ?? null,
  });
  return data<ProfileActionData>({ saved: true, errors: {}, values: null });
}

export default function ProfilePage({ loaderData, actionData }: Route.ComponentProps) {
  const { profile, cities, email } = loaderData;
  const errors = actionData?.errors ?? {};
  const values = actionData?.values;
  return (
    <>
      <PageHeader title="আমার প্রোফাইল / My profile" description="This information helps owners and seekers trust each other. Your e-mail is never shown publicly." />
      <Card className="max-w-xl">
        {actionData?.saved ? <Alert tone="success">Profile saved.</Alert> : null}
        <Form method="post" className="mt-4 space-y-4" noValidate>
          <div>
            <p className="text-sm font-medium text-slate-800">Account e-mail</p>
            <p className="text-slate-700">{email}</p>
          </div>
          <TextField label="নাম / Display name" name="displayName" autoComplete="name" required defaultValue={values?.displayName ?? profile.displayName} error={errors.displayName} />
          <TextField label="ফোন / Phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={values?.phone ?? profile.phone ?? ""} error={errors.phone} />
          <TextField label="WhatsApp" name="whatsapp" type="tel" inputMode="tel" defaultValue={values?.whatsapp ?? profile.whatsapp ?? ""} error={errors.whatsapp} />
          <SelectField
            label="পছন্দের শহর / Preferred city"
            name="preferredCityId"
            defaultValue={values?.preferredCityId ?? (profile.preferredCityId === null ? "" : String(profile.preferredCityId))}
            placeholder="Not set"
            options={cities.map((city) => ({ value: String(city.id), label: city.nameBn ? `${city.nameBn} · ${city.name}` : city.name }))}
            error={errors.preferredCityId}
          />
          <TextAreaField label="সম্পর্কে / About you" name="bio" maxLength={500} defaultValue={values?.bio ?? profile.bio ?? ""} error={errors.bio} />
          <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
        </Form>
      </Card>
    </>
  );
}
