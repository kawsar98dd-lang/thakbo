export interface CheckboxOption {
  value: string;
  label: string;
}

/** A group of checkboxes sharing one field name (submitted as repeated values). Real <fieldset>/<legend> for screen readers. */
export function CheckboxGroup({
  legend,
  name,
  options,
  selected,
  error,
}: {
  legend: string;
  name: string;
  options: readonly CheckboxOption[];
  selected: readonly string[];
  error?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-800">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
              className="size-5 accent-brand-700"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
    </fieldset>
  );
}
