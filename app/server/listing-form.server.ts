import { data } from "react-router";
import type { ListingFormActionData, ListingFormValues } from "~/lib/listing-form";
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
