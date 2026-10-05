import { z } from "zod";
import { AREA_SEARCH_LIMITS, AREA_TYPES } from "../constants";
import { LOCATION_TEXT_MAX_LENGTH } from "../location";
import { emptyToUndefined, slugParam } from "./common";

const positiveId = z.coerce.number().int().positive();

/** Query of GET /api/areas?cityId=1&q=hatem&parentId=3 */
export const areaSearchSchema = z.object({
  cityId: positiveId,
  q: z.preprocess(emptyToUndefined, z.string().trim().max(AREA_SEARCH_LIMITS.maxQueryLength).optional()),
  parentId: z.preprocess(emptyToUndefined, positiveId.optional()),
});

export type AreaSearchInput = z.infer<typeof areaSearchSchema>;

const aliasText = z.string().trim().min(1).max(LOCATION_TEXT_MAX_LENGTH);

/** Input for creating a neighborhood / sub-area (used by the future admin screens and by seed tooling). */
export const areaInputSchema = z
  .object({
    cityId: positiveId,
    name: z.string().trim().min(2).max(LOCATION_TEXT_MAX_LENGTH),
    nameEn: z.preprocess(emptyToUndefined, z.string().trim().max(LOCATION_TEXT_MAX_LENGTH).optional()),
    nameBn: z.preprocess(emptyToUndefined, z.string().trim().max(LOCATION_TEXT_MAX_LENGTH).optional()),
    slug: slugParam,
    areaType: z.enum(AREA_TYPES).default("neighborhood"),
    parentAreaId: z.preprocess(emptyToUndefined, positiveId.optional()),
    latitude: z.preprocess(emptyToUndefined, z.coerce.number().min(-90).max(90).optional()),
    longitude: z.preprocess(emptyToUndefined, z.coerce.number().min(-180).max(180).optional()),
    radiusM: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50_000).optional()),
    searchPriority: z.coerce.number().int().min(0).max(1000).default(0),
    aliases: z.array(aliasText).max(30).default([]),
  })
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
    message: "Provide both latitude and longitude, or neither.",
    path: ["latitude"],
  });

export type AreaInputData = z.infer<typeof areaInputSchema>;
