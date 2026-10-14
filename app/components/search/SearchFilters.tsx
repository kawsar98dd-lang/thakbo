import { useState } from "react";
import { Form, Link } from "react-router";
import { Button } from "~/components/ui/Button";
import { CheckboxGroup } from "~/components/forms/CheckboxGroup";
import { SelectField } from "~/components/forms/SelectField";
import { TextField } from "~/components/forms/TextField";
import { AUDIENCES, AUDIENCE_LABELS, PROPERTY_TYPES, PROPERTY_TYPE_LABELS, SEARCH_SORTS, SEARCH_SORT_LABELS, SEARCH_LIMITS } from "~/lib/constants";
import { describeLocationError, parseLocationInput } from "~/lib/coordinates";
import type { SearchParams } from "~/lib/validation/search";
import type { City } from "~/server/db/repositories/locations";
import type { Facility } from "~/server/db/repositories/facilities";

export function SearchFilters({ cities, facilities, values, areaInput, areaSearchError }: {
  cities: City[]; facilities: Facility[]; values: SearchParams; areaInput?: string; areaSearchError?: string | null;
}) {
  const [lat, setLat] = useState(values.lat === undefined ? "" : String(values.lat));
  const [lng, setLng] = useState(values.lng === undefined ? "" : String(values.lng));
  const [radius, setRadius] = useState(String(values.radiusKm ?? 3));
  const [geoMessage, setGeoMessage] = useState("");
  const [geoBusy, setGeoBusy] = useState(false);
  const [locationLink, setLocationLink] = useState("");
  const useMyLocation = () => {
    if (geoBusy) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeoMessage("This browser cannot access your location. Paste a Google Maps link or choose a city/area instead."); return; }
    setGeoBusy(true);
    setGeoMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition((position) => {
      setLat(position.coords.latitude.toFixed(6)); setLng(position.coords.longitude.toFixed(6));
      setGeoBusy(false);
      setGeoMessage("Location set. Choose a radius and search.");
    }, (error) => {
      setGeoBusy(false);
      setGeoMessage(error.code === 1
        ? "Location permission was denied. Allow it in browser settings, or paste a Google Maps link."
        : error.code === 3
          ? "Finding your location took too long. Try again or paste a Google Maps link."
          : "Could not get your location. Try again or paste a Google Maps link.");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };
  const handleMapLink = () => {
    const parsed = parseLocationInput(locationLink);
    if (!parsed.ok) {
      setGeoMessage(describeLocationError(parsed.reason));
      return;
    }
    setLat(parsed.latitude.toFixed(6));
    setLng(parsed.longitude.toFixed(6));
    setGeoMessage("Location set from the map link. Choose a radius and search.");
  };
  return (
    <Form method="get" action="/search" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField label="City" name="city" defaultValue={values.city ?? ""} placeholder="Any city" options={cities.map((city) => ({ value: city.slug, label: city.nameBn ? `${city.nameBn} · ${city.name}` : city.name }))} />
        <div>
          <TextField label="Area / neighbourhood" name="area" defaultValue={areaInput ?? values.area ?? ""} placeholder="e.g. Hatem Khan / হেতেম খান" autoComplete="off" />
          {areaSearchError ? <p role="status" className="mt-1 text-sm text-amber-800">{areaSearchError}</p> : <p className="mt-1 text-xs text-slate-500">Known English and Bangla neighbourhood names are supported.</p>}
        </div>
        <TextField label="Minimum price (৳ / month)" name="min_price" type="number" inputMode="numeric" min={0} defaultValue={values.minPrice ?? ""} />
        <TextField label="Maximum price (৳ / month)" name="max_price" type="number" inputMode="numeric" min={0} defaultValue={values.maxPrice ?? ""} />
        <SelectField label="Availability" name="available" defaultValue={values.availableNow ? "now" : ""} placeholder="Any availability" options={[{ value: "now", label: "Available now" }]} />
        <TextField label="Available by date" name="available_from" type="date" defaultValue={values.availableBy ?? ""} hint="Include places available by this date." />
        <SelectField label="Sort by" name="sort" defaultValue={values.sort} options={SEARCH_SORTS.map((value) => ({ value, label: SEARCH_SORT_LABELS[value] }))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CheckboxGroup legend="Property type" name="type" selected={values.types} options={PROPERTY_TYPES.map((value) => ({ value, label: PROPERTY_TYPE_LABELS[value] }))} />
        <CheckboxGroup legend="Suitable for" name="audience" selected={values.audiences} options={AUDIENCES.map((value) => ({ value, label: AUDIENCE_LABELS[value] }))} />
      </div>
      {facilities.length ? <CheckboxGroup legend="Facilities (a place must have every selected facility)" name="facility" selected={values.facilities} options={facilities.map((facility) => ({ value: facility.slug, label: facility.nameBn ? `${facility.nameBn} · ${facility.name}` : facility.name }))} /> : null}

      <div className="rounded-lg border border-slate-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Search around a place</h3><p className="text-sm text-slate-600">Find places near your current location or a point from Google Maps. Coordinates are used for this search only.</p></div><Button type="button" variant="secondary" onClick={useMyLocation} loading={geoBusy}>{geoBusy ? "Finding location…" : "Use my current location"}</Button></div>
        <div className="mt-3 space-y-2">
          <label htmlFor="searchLocationLink" className="block text-sm font-medium text-slate-800">Or paste a full Google Maps link</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="searchLocationLink" type="text" inputMode="url" autoComplete="off" value={locationLink} onChange={(event) => setLocationLink(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); handleMapLink(); } }} placeholder="https://www.google.com/maps/…" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400" />
            <Button type="button" variant="secondary" onClick={handleMapLink}>Use map link</Button>
          </div>
          <p className="text-xs text-slate-500">Short links may not contain readable coordinates. Open them in Maps and copy the full link instead.</p>
        </div>
        {geoMessage ? <p role="status" aria-live="polite" className="mt-2 text-sm text-slate-700">{geoMessage}</p> : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium text-slate-800">Radius<select name="radius" value={radius} onChange={(e) => setRadius(e.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base">{[1, 2, 3, 5, 10, 15, SEARCH_LIMITS.maxRadiusKm].map((km) => <option key={km} value={km}>{km} km</option>)}</select></label>
          <input type="hidden" name="lat" value={lat} />
          <input type="hidden" name="lng" value={lng} />
        </div>
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brand-800 underline">Advanced: enter coordinates manually</summary>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <TextField label="Latitude" type="number" step="any" min={-90} max={90} value={lat} onChange={(e) => setLat(e.target.value)} />
            <TextField label="Longitude" type="number" step="any" min={-180} max={180} value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>
        </details>
      </div>
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" size="lg">Search places</Button><Link to="/search" className="inline-flex min-h-11 items-center px-3 font-semibold text-brand-800 underline">Clear all filters</Link></div>
    </Form>
  );
}
