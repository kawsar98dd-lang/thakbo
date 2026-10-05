import { useRef, useState, type ChangeEvent } from "react";
import { useFetcher } from "react-router";
import { SelectField } from "~/components/forms/SelectField";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Spinner } from "~/components/ui/Spinner";
import type { ListingFormValues } from "~/lib/listing-form";
import { PATHS } from "~/lib/routes";
import { cx } from "~/lib/utils";
import type { AreaOption, City } from "~/server/db/repositories/locations";

interface AreaResponse {
  areas: AreaOption[];
  error?: string;
}

interface AreaPickerProps {
  cities: City[];
  values: Pick<ListingFormValues, "cityId" | "areaId" | "subAreaId">;
  errors: Record<string, string>;
  /** Neighborhood already chosen (editing a draft, or a form re-shown after an error). */
  selectedArea: AreaOption | null;
  /** Neighborhoods offered for the initially selected city. */
  initialAreas: AreaOption[];
  /** Sub-areas of the initially selected neighborhood. */
  initialSubAreas: AreaOption[];
}

const SEARCH_DELAY_MS = 250;

const optionLabel = (option: AreaOption) => (option.nameBn ? `${option.nameBn} · ${option.name}` : option.name);

/**
 * City → Neighborhood (searchable, Bangla / English / alternative spellings) → optional Sub-area.
 * The neighborhood list comes from the server (GET /api/areas), a few results at a time: the browser never holds
 * a whole city's location list. The server re-checks the city/neighborhood relationship on submit anyway.
 */
export function AreaPicker({ cities, values, errors, selectedArea, initialAreas, initialSubAreas }: AreaPickerProps) {
  const areaFetcher = useFetcher<AreaResponse>();
  const subFetcher = useFetcher<AreaResponse>();
  const timer = useRef<number | null>(null);

  const [cityId, setCityId] = useState(values.cityId);
  const [area, setArea] = useState<AreaOption | null>(selectedArea);
  const [query, setQuery] = useState("");
  const [areaRequestedFor, setAreaRequestedFor] = useState<string | null>(null);
  const [subRequestedFor, setSubRequestedFor] = useState<number | null>(null);

  const loadAreas = (forCity: string, text: string) => {
    if (forCity === "") return;
    setAreaRequestedFor(forCity);
    const params = new URLSearchParams({ cityId: forCity });
    if (text.trim() !== "") params.set("q", text.trim());
    void areaFetcher.load(`${PATHS.areasApi}?${params.toString()}`);
  };

  const onCityChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    setCityId(next);
    setArea(null);
    setQuery("");
    setSubRequestedFor(null);
    loadAreas(next, "");
  };

  const onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    setQuery(text);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => loadAreas(cityId, text), SEARCH_DELAY_MS);
  };

  const chooseArea = (option: AreaOption) => {
    setArea(option);
    setQuery("");
    setSubRequestedFor(option.id);
    void subFetcher.load(`${PATHS.areasApi}?cityId=${encodeURIComponent(cityId)}&parentId=${option.id}`);
  };

  const areaOptions: AreaOption[] =
    areaRequestedFor === cityId && areaFetcher.data ? areaFetcher.data.areas : cityId === values.cityId ? initialAreas : [];
  const searching = areaFetcher.state !== "idle";
  const areaError = areaRequestedFor === cityId ? areaFetcher.data?.error : undefined;

  const subOptions: AreaOption[] =
    area !== null && subRequestedFor === area.id && subFetcher.data
      ? subFetcher.data.areas
      : area !== null && String(area.id) === values.areaId
        ? initialSubAreas
        : [];

  return (
    <div className="space-y-4">
      <SelectField
        label="শহর / City"
        name="cityId"
        value={cityId}
        onChange={onCityChange}
        placeholder="Choose a city"
        options={cities.map((city) => ({ value: String(city.id), label: city.nameBn ? `${city.nameBn} · ${city.name}` : city.name }))}
        error={errors.cityId}
      />

      <div className="space-y-2">
        <input type="hidden" name="areaId" value={area ? String(area.id) : ""} />
        <p id="area-label" className="text-sm font-medium text-slate-800">
          এলাকা / Neighborhood
        </p>

        {area ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2">
            <p className="min-w-0 font-semibold text-brand-900">
              {optionLabel(area)}
            </p>
            <Button variant="ghost" onClick={() => setArea(null)}>
              Change
            </Button>
          </div>
        ) : cityId === "" ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
            Choose a city first, then search for your neighborhood.
          </p>
        ) : (
          <div className="space-y-2">
            <input
              type="search"
              value={query}
              onChange={onQueryChange}
              placeholder="e.g. Hetem Khan, হেতেম খান, Saheb Bazar"
              autoComplete="off"
              aria-labelledby="area-label"
              className="block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
            />
            <p className="text-xs text-slate-600">Search in English, বাংলা or any common spelling.</p>
            {searching ? (
              <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
                <Spinner /> Loading places…
              </p>
            ) : null}
            {areaError ? <Alert tone="error">{areaError}</Alert> : null}
            {!searching && !areaError && areaOptions.length === 0 ? (
              <p className="text-sm text-slate-600">No matching neighborhood found. Try another spelling.</p>
            ) : null}
            <ul className="grid gap-2 sm:grid-cols-2">
              {areaOptions.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => chooseArea(option)}
                    className={cx(
                      "flex min-h-11 w-full flex-col items-start justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm",
                      "hover:bg-brand-50",
                    )}
                  >
                    <span className="font-medium">{optionLabel(option)}</span>
                    {option.matchedAlias && option.matchedAlias !== option.name ? (
                      <span className="text-xs text-slate-600">matched “{option.matchedAlias}”</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {errors.areaId ? <p className="text-sm font-medium text-red-700">{errors.areaId}</p> : null}
      </div>

      {area && subOptions.length > 0 ? (
        <SelectField
          key={area.id}
          label="উপ-এলাকা / Sub-area (optional)"
          name="subAreaId"
          defaultValue={String(area.id) === values.areaId ? values.subAreaId : ""}
          placeholder="No sub-area"
          options={subOptions.map((option) => ({ value: String(option.id), label: optionLabel(option) }))}
          error={errors.subAreaId}
        />
      ) : null}
    </div>
  );
}
