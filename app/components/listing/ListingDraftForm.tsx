import type { ReactNode } from "react";
import { Form } from "react-router";
import { CheckboxGroup } from "~/components/forms/CheckboxGroup";
import { SelectField } from "~/components/forms/SelectField";
import { SubmitButton } from "~/components/forms/SubmitButton";
import { TextAreaField } from "~/components/forms/TextAreaField";
import { TextField } from "~/components/forms/TextField";
import { Alert } from "~/components/ui/Alert";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  AUDIENCE_LABELS_BN,
  AVAILABILITY_LABELS,
  AVAILABILITY_STATUSES,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPE_LABELS_BN,
} from "~/lib/constants";
import type { ListingFormValues } from "~/lib/listing-form";
import type { Facility } from "~/server/db/repositories/facilities";
import type { AreaOption, City } from "~/server/db/repositories/locations";
import { AreaPicker } from "./AreaPicker";

interface ListingDraftFormProps {
  cities: City[];
  facilities: Facility[];
  values: ListingFormValues;
  errors: Record<string, string>;
  selectedArea: AreaOption | null;
  initialAreas: AreaOption[];
  initialSubAreas: AreaOption[];
  submitLabel: string;
  /** True while a draft is shown read-only (e.g. an already published listing). */
  readOnly?: boolean;
}

const SECTION = "space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={SECTION}>
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** One form for creating AND editing a draft. Never contains owner, status or slug fields: the server decides those. */
export function ListingDraftForm({
  cities,
  facilities,
  values,
  errors,
  selectedArea,
  initialAreas,
  initialSubAreas,
  submitLabel,
  readOnly = false,
}: ListingDraftFormProps) {
  return (
    <Form method="post" className="space-y-6" noValidate>
      {errors.form ? <Alert tone="error">{errors.form}</Alert> : null}
      <fieldset disabled={readOnly} className="space-y-6">
        <Section title="1. Basic information">
          <TextField label="শিরোনাম / Title" name="title" defaultValue={values.title} maxLength={120} error={errors.title} hint="Example: Student mess near Shaheb Bazar" />
          <TextAreaField label="বিবরণ / Description" name="description" defaultValue={values.description} maxLength={5000} error={errors.description} />
        </Section>

        <Section title="2. Accommodation type">
          <SelectField
            label="ধরন / Type"
            name="propertyType"
            defaultValue={values.propertyType}
            placeholder="Choose a type"
            options={PROPERTY_TYPES.map((type) => ({ value: type, label: `${PROPERTY_TYPE_LABELS_BN[type]} · ${PROPERTY_TYPE_LABELS[type]}` }))}
            error={errors.propertyType}
          />
        </Section>

        <Section title="3. Audience">
          <CheckboxGroup
            legend="কাদের জন্য / Suitable for"
            name="audiences"
            selected={values.audiences}
            options={AUDIENCES.map((audience) => ({ value: audience, label: `${AUDIENCE_LABELS_BN[audience]} · ${AUDIENCE_LABELS[audience]}` }))}
            error={errors.audiences}
          />
        </Section>

        <Section title="4. Price (৳ per month)">
          <TextField label="ভাড়া / Rent" name="rentAmount" type="number" inputMode="numeric" min={0} defaultValue={values.rentAmount} error={errors.rentAmount} />
          <TextField label="অগ্রিম / Deposit" name="advanceAmount" type="number" inputMode="numeric" min={0} defaultValue={values.advanceAmount} error={errors.advanceAmount} />
          <details className="rounded-lg border border-slate-200 p-3">
            <summary className="min-h-11 cursor-pointer text-sm font-medium">More monthly costs (optional)</summary>
            <div className="mt-3 space-y-4">
              <TextField label="খাবার / Meal" name="mealCost" type="number" inputMode="numeric" min={0} defaultValue={values.mealCost} error={errors.mealCost} />
              <TextField label="বিদ্যুৎ / Electricity" name="electricityCost" type="number" inputMode="numeric" min={0} defaultValue={values.electricityCost} error={errors.electricityCost} />
              <TextField label="ওয়াই-ফাই / Wi-Fi" name="wifiCost" type="number" inputMode="numeric" min={0} defaultValue={values.wifiCost} error={errors.wifiCost} />
              <TextField label="অন্যান্য / Other" name="otherMonthlyCost" type="number" inputMode="numeric" min={0} defaultValue={values.otherMonthlyCost} error={errors.otherMonthlyCost} />
            </div>
          </details>
        </Section>

        <Section title="5. Location">
          <AreaPicker
            cities={cities}
            values={values}
            errors={errors}
            selectedArea={selectedArea}
            initialAreas={initialAreas}
            initialSubAreas={initialSubAreas}
          />
          <TextField label="ঠিকানা / Address" name="address" defaultValue={values.address} maxLength={300} error={errors.address} hint="Optional. Shown only as much as you decide in a later step." />
          <TextField label="ল্যান্ডমার্ক / Landmark" name="landmark" defaultValue={values.landmark} maxLength={200} error={errors.landmark} hint="Example: Near the central mosque" />
        </Section>

        <Section title="6. Facilities">
          <CheckboxGroup
            legend="সুবিধা / Facilities"
            name="facilityIds"
            selected={values.facilityIds}
            options={facilities.map((facility) => ({
              value: String(facility.id),
              label: facility.nameBn ? `${facility.nameBn} · ${facility.nameEn ?? facility.name}` : (facility.nameEn ?? facility.name),
            }))}
            error={errors.facilityIds}
          />
        </Section>

        <Section title="7. Availability">
          <SelectField
            label="Availability"
            name="availabilityStatus"
            defaultValue={values.availabilityStatus}
            options={AVAILABILITY_STATUSES.map((status) => ({ value: status, label: AVAILABILITY_LABELS[status] }))}
            error={errors.availabilityStatus}
          />
          <TextField label="Available from (if a date applies)" name="availableFrom" type="date" defaultValue={values.availableFrom} error={errors.availableFrom} />
        </Section>
      </fieldset>

      {readOnly ? null : (
        <Section title="8. Save">
          <p className="text-sm text-slate-600">Your listing is saved as a private draft. It is not visible to anyone else.</p>
          <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
        </Section>
      )}
    </Form>
  );
}
