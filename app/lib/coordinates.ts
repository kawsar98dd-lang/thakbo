import { distanceKm, type GeoPoint } from "./geo";

/**
 * Location rules for listings. Pure functions, no map vendor and no network access:
 * the browser may use its own geolocation, and a pasted Google Maps link is parsed LOCALLY (never fetched).
 * Nothing here ever invents a coordinate: a missing or invalid location is an error, never a default.
 */

/** Generous rectangle around Bangladesh. A coordinate outside it is rejected as a mistake. */
export const BANGLADESH_BOUNDS = { minLat: 20.5, maxLat: 26.7, minLng: 88.0, maxLng: 92.8 } as const;

/** A listing must be reasonably close to the city it claims to be in (only used when the city has a known centre). */
export const MAX_DISTANCE_FROM_CITY_KM = 60;

export function isInBangladesh(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= BANGLADESH_BOUNDS.minLat &&
    latitude <= BANGLADESH_BOUNDS.maxLat &&
    longitude >= BANGLADESH_BOUNDS.minLng &&
    longitude <= BANGLADESH_BOUNDS.maxLng
  );
}

/** About 0.1 m precision; avoids storing floating-point noise such as 24.370000000000001. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export type CoordinateCheck = { ok: true; latitude: number; longitude: number } | { ok: false; error: string };

export const LOCATION_MESSAGES = {
  missing: "Choose the exact location of the place.",
  invalid: "This location is not valid. Please choose it again.",
  outsideBangladesh: "This location is outside Bangladesh. Please choose it again.",
  farFromCity: "This location is far from the selected city. Check the city or choose the location again.",
} as const;

/** Accepts only finite numbers inside Bangladesh. `unknown` input so form strings and JSON values are both safe. */
export function checkCoordinates(latitude: unknown, longitude: unknown): CoordinateCheck {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return { ok: false, error: LOCATION_MESSAGES.missing };
  }
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, error: LOCATION_MESSAGES.invalid };
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { ok: false, error: LOCATION_MESSAGES.invalid };
  }
  if (!isInBangladesh(latitude, longitude)) return { ok: false, error: LOCATION_MESSAGES.outsideBangladesh };
  return { ok: true, latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude) };
}

/** Returns an error message when the point is too far from the city centre, otherwise null. No centre → no check. */
export function checkNearCity(point: GeoPoint, cityCentre: GeoPoint | null | undefined): string | null {
  if (!cityCentre) return null;
  if (!Number.isFinite(cityCentre.latitude) || !Number.isFinite(cityCentre.longitude)) return null;
  return distanceKm(point, cityCentre) > MAX_DISTANCE_FROM_CITY_KM ? LOCATION_MESSAGES.farFromCity : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Pasted locations (Google Maps links, or "lat, lng" text copied from a share message)
// ---------------------------------------------------------------------------------------------------------------

export type LocationParseFailure = "empty" | "short_link" | "unsupported" | "out_of_range";
export type LocationParse =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: LocationParseFailure };

const NUMBER = String.raw`-?\d{1,3}(?:\.\d{1,15})?`;
const PAIR_ONLY = new RegExp(`^(${NUMBER})\\s*,\\s*(${NUMBER})$`);
const PLACE_PIN = new RegExp(`!3d(${NUMBER})!4d(${NUMBER})`);
const VIEWPORT = new RegExp(`@(${NUMBER}),(${NUMBER})(?:[,/]|$)`);
const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i;
const QUERY_KEYS = ["q", "query", "ll", "destination", "center"] as const;

/** Hosts whose full links carry coordinates. Short links need a network lookup, which we never do. */
const MAPS_HOSTS = new Set(["google.com", "www.google.com", "maps.google.com", "google.com.bd", "www.google.com.bd"]);
const SHORT_LINK_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);

function finishPair(latitudeText: string, longitudeText: string): LocationParse {
  const check = checkCoordinates(Number(latitudeText), Number(longitudeText));
  return check.ok ? { ok: true, latitude: check.latitude, longitude: check.longitude } : { ok: false, reason: "out_of_range" };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Reads coordinates out of pasted text without contacting anyone. Supported:
 *  - "24.3745, 88.6042"
 *  - https://www.google.com/maps/place/.../@24.3745,88.6042,17z/data=...!3d24.3745!4d88.6042
 *  - https://www.google.com/maps?q=24.3745,88.6042  (also query=, ll=, destination=, center=)
 *  - https://maps.google.com/?q=24.3745,88.6042
 * Short links (maps.app.goo.gl) are refused with a helpful message: resolving them would need a server request.
 */
export function parseLocationInput(raw: string): LocationParse {
  const text = raw.trim();
  if (text === "") return { ok: false, reason: "empty" };
  if (text.length > 2000) return { ok: false, reason: "unsupported" };

  const plain = PAIR_ONLY.exec(text);
  if (plain) return finishPair(plain[1] ?? "", plain[2] ?? "");

  const token = URL_IN_TEXT.exec(text)?.[0];
  if (!token) return { ok: false, reason: "unsupported" };

  let url: URL;
  try {
    url = new URL(token);
  } catch {
    return { ok: false, reason: "unsupported" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "unsupported" };

  const host = url.hostname.toLowerCase();
  if (SHORT_LINK_HOSTS.has(host)) return { ok: false, reason: "short_link" };
  if (!MAPS_HOSTS.has(host)) return { ok: false, reason: "unsupported" };
  if (host !== "maps.google.com" && !url.pathname.startsWith("/maps")) return { ok: false, reason: "unsupported" };

  const path = safeDecode(url.pathname);
  const pin = PLACE_PIN.exec(path) ?? PLACE_PIN.exec(safeDecode(url.search));
  if (pin) return finishPair(pin[1] ?? "", pin[2] ?? "");

  const viewport = VIEWPORT.exec(path);
  if (viewport) return finishPair(viewport[1] ?? "", viewport[2] ?? "");

  for (const key of QUERY_KEYS) {
    const value = url.searchParams.get(key)?.trim();
    const pair = value ? PAIR_ONLY.exec(value) : null;
    if (pair) return finishPair(pair[1] ?? "", pair[2] ?? "");
  }
  return { ok: false, reason: "unsupported" };
}

export function describeLocationError(reason: LocationParseFailure): string {
  switch (reason) {
    case "empty":
      return "Paste a Google Maps link first.";
    case "short_link":
      return "Short links such as maps.app.goo.gl cannot be read. Open the link, then copy the full address from the browser (it contains the place's numbers).";
    case "out_of_range":
      return LOCATION_MESSAGES.outsideBangladesh;
    default:
      return "This link or text does not contain a location we can read. Paste a full Google Maps link, or use your current location.";
  }
}

const isBlank = (value: unknown): boolean => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/**
 * Server-side use of the pasted-link field (works without JavaScript): when the form carries no coordinates but does
 * carry a link, read the coordinates from the link. Existing coordinates always win; nothing is ever defaulted.
 */
export function resolveLocationFields(input: {
  latitude: unknown;
  longitude: unknown;
  link: unknown;
}): { latitude: unknown; longitude: unknown; error?: string } {
  if (!isBlank(input.latitude) || !isBlank(input.longitude)) return { latitude: input.latitude, longitude: input.longitude };
  if (typeof input.link !== "string" || input.link.trim() === "") return { latitude: input.latitude, longitude: input.longitude };
  const parsed = parseLocationInput(input.link);
  if (!parsed.ok) return { latitude: input.latitude, longitude: input.longitude, error: describeLocationError(parsed.reason) };
  return { latitude: String(parsed.latitude), longitude: String(parsed.longitude) };
}
