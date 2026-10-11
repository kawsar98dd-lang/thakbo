import { data } from "react-router";
import { resolveLocationFields } from "~/lib/coordinates";
import { valuesFromForm, type ListingFormActionData, type ListingFormValues } from "~/lib/listing-form";
import { formToObject } from "~/lib/validation/form";
import { LISTING_DRAFT_FIELDS, LISTING_DRAFT_MULTI_FIELDS } from "~/lib/validation/listing";
import { getActiveAreaById, listActiveSubAreas, searchAreas, type AreaOption } from "./db/repositories/locations";

const toId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export interface LocationFormData {
  selectedArea: AreaOption | null;
  initialAreas: AreaOption[];
  subAreas: AreaOption[];
}

/**
 * Data the neighborhood picker needs to render the current selection: the neighborhoods of the chosen city (a short,
 * server-limited list), the chosen neighborhood (only if it really belongs to that city) and its sub-areas.
 */
export async function loadLocationFormData(
  db: D1Database,
  values: Pick<ListingFormValues, "cityId" | "areaId">,
): Promise<LocationFormData> {
  const cityId = toId(values.cityId);
  const areaId = toId(values.areaId);

  const initialAreas = cityId !== null ? await searchAreas(db, cityId, undefined) : [];
  const area = areaId !== null ? await getActiveAreaById(db, areaId) : null;
  const selectedArea: AreaOption | null =
    area !== null && area.cityId === cityId
      ? { id: area.id, name: area.name, nameBn: area.nameBn, slug: area.slug, areaType: area.areaType, parentAreaId: area.parentAreaId, matchedAlias: null }
      : null;
  const subAreas = selectedArea !== null ? await listActiveSubAreas(db, selectedArea.id) : [];
  return { selectedArea, initialAreas, subAreas };
}

/** 400 response that re-shows the form with the user's input and the error messages. */
export async function invalidFormResponse(db: D1Database, values: ListingFormValues, errors: Record<string, string>) {
  const location = await loadLocationFormData(db, values);
  return data<ListingFormActionData>(
    { saved: false, errors, values, selectedArea: location.selectedArea, subAreas: location.subAreas },
    { status: 400 },
  );
}

/**
 * Reads the listing form: the text to re-show after an error, the whitelisted fields for validation, and — only when
 * the browser sent no coordinates but a pasted map link — the coordinates read LOCALLY from that link (never fetched).
 */
export function readListingForm(form: FormData): {
  values: ListingFormValues;
  raw: Record<string, unknown>;
  locationError: string | undefined;
} {
  const values = valuesFromForm(form);
  const raw = formToObject(form, LISTING_DRAFT_FIELDS, LISTING_DRAFT_MULTI_FIELDS);
  const location = resolveLocationFields({ latitude: raw.latitude, longitude: raw.longitude, link: form.get("locationLink") });
  raw.latitude = location.latitude;
  raw.longitude = location.longitude;
  if (typeof location.latitude === "string") values.latitude = location.latitude;
  if (typeof location.longitude === "string") values.longitude = location.longitude;
  return { values, raw, locationError: location.error };
}
