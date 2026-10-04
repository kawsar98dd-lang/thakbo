import { z } from "zod";
import {
  AUDIENCES,
  PROPERTY_TYPES,
  SEARCH_LIMITS,
  SEARCH_SORTS,
  type Audience,
  type PropertyType,
  type SearchSort,
} from "../constants";
import { slugParam } from "./common";

export interface SearchParams {
  city?: string;
  area?: string;
  types: PropertyType[];
  audiences: Audience[];
  facilities: string[];
  minPrice?: number;
  maxPrice?: number;
  availableNow: boolean;
  availableBy?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort: SearchSort;
  page: number;
  pageSize: number;
}

/** Accepts repeated keys (?type=a&type=b) and comma lists (?type=a,b). */
function list(sp: URLSearchParams, ...keys: string[]): string[] {
  const values = keys.flatMap((key) => sp.getAll(key)).flatMap((v) => v.split(","));
  return [...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean))];
}

function isMember<T extends string>(allowed: readonly T[], value: string): value is T {
  return (allowed as readonly string[]).includes(value);
}

const num = (min: number, max: number) =>
  z.coerce.number().refine(Number.isFinite).pipe(z.number().min(min).max(max));

const scalar = z.object({
  city: slugParam.optional().catch(undefined),
  area: slugParam.optional().catch(undefined),
  min_price: num(0, 100_000_000).optional().catch(undefined),
  max_price: num(0, 100_000_000).optional().catch(undefined),
  available_from: z.iso.date().optional().catch(undefined),
  lat: num(-90, 90).optional().catch(undefined),
  lng: num(-180, 180).optional().catch(undefined),
  radius: num(0.1, SEARCH_LIMITS.maxRadiusKm).optional().catch(undefined),
  sort: z.enum(SEARCH_SORTS).catch("newest"),
  page: z.coerce.number().int().min(1).max(SEARCH_LIMITS.maxPage).catch(1),
});

/**
 * Parses shareable search URLs such as
 *   /search?city=rajshahi&area=talaimari
 *   /search?city=rajshahi&type=mess&audience=student&max_price=5000
 * Invalid values are ignored instead of failing, so a malformed link still opens a usable page.
 */
export function parseSearchParams(sp: URLSearchParams): SearchParams {
  const raw: Record<string, string | undefined> = {};
  for (const key of ["city", "area", "min_price", "max_price", "available_from", "lat", "lng", "radius", "sort", "page"]) {
    const value = sp.get(key);
    raw[key] = value === null || value.trim() === "" ? undefined : value.trim();
  }
  const s = scalar.parse(raw);

  const hasPoint = s.lat !== undefined && s.lng !== undefined;
  return {
    city: s.city,
    area: s.area,
    types: list(sp, "type").filter((v): v is PropertyType => isMember(PROPERTY_TYPES, v)),
    audiences: list(sp, "audience").filter((v): v is Audience => isMember(AUDIENCES, v)),
    facilities: list(sp, "facility", "facilities").filter((v) => slugParam.safeParse(v).success),
    minPrice: s.min_price,
    maxPrice: s.max_price,
    availableNow: sp.get("available") === "now",
    availableBy: s.available_from,
    lat: hasPoint ? s.lat : undefined,
    lng: hasPoint ? s.lng : undefined,
    radiusKm: hasPoint ? (s.radius ?? 3) : undefined,
    sort: s.sort,
    page: s.page,
    pageSize: SEARCH_LIMITS.defaultPageSize,
  };
}
