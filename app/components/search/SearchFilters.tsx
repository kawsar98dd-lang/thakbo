import { Form } from "react-router";
import { Button } from "~/components/ui/Button";
import { SelectField } from "~/components/forms/SelectField";
import { TextField } from "~/components/forms/TextField";
import { AUDIENCES, AUDIENCE_LABELS, PROPERTY_TYPES, PROPERTY_TYPE_LABELS, SEARCH_SORTS, SEARCH_SORT_LABELS } from "~/lib/constants";
import type { SearchParams } from "~/lib/validation/search";
import type { City } from "~/server/db/repositories/locations";

/**
 * A plain GET form: filters live in the URL (/search?city=...&type=...), so every result page is
 * shareable and works without JavaScript. Radius/map filters arrive in Milestone 4.
 */
export function SearchFilters({ cities, values }: { cities: City[]; values: SearchParams }) {
  return (
    <Form method="get" action="/search" className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
      <SelectField
        label="City"
        name="city"
        defaultValue={values.city ?? ""}
        placeholder="Any city"
        options={cities.map((city) => ({ value: city.slug, label: city.name }))}
      />
      <SelectField
        label="Property type"
        name="type"
        defaultValue={values.types[0] ?? ""}
        placeholder="Any type"
        options={PROPERTY_TYPES.map((value) => ({ value, label: PROPERTY_TYPE_LABELS[value] }))}
      />
      <SelectField
        label="Suitable for"
        name="audience"
        defaultValue={values.audiences[0] ?? ""}
        placeholder="Anyone"
        options={AUDIENCES.map((value) => ({ value, label: AUDIENCE_LABELS[value] }))}
      />
      <TextField label="Max price (৳ / month)" name="max_price" type="number" inputMode="numeric" min={0} defaultValue={values.maxPrice ?? ""} />
      <SelectField
        label="Sort by"
        name="sort"
        defaultValue={values.sort}
        options={SEARCH_SORTS.map((value) => ({ value, label: SEARCH_SORT_LABELS[value] }))}
      />
      <div className="flex items-end">
        <Button type="submit" size="lg" className="w-full">
          Search places
        </Button>
      </div>
    </Form>
  );
}
