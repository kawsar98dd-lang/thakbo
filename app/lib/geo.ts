/** Pure geographic helpers. No map provider is referenced here (see map/provider abstraction below). */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Rectangle that fully contains the circle of `radiusKm` around `center`.
 * Used as a cheap indexed pre-filter in SQL; exact distance is checked afterwards.
 */
export function boundingBox(center: GeoPoint, radiusKm: number): BoundingBox {
  const latDelta = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const cosLat = Math.max(Math.cos(toRadians(center.latitude)), 1e-6);
  const lngDelta = latDelta / cosLat;
  return {
    minLat: Math.max(-90, center.latitude - latDelta),
    maxLat: Math.min(90, center.latitude + latDelta),
    minLng: Math.max(-180, center.longitude - lngDelta),
    maxLng: Math.min(180, center.longitude + lngDelta),
  };
}

/** Contract that any future map/geocoding vendor must satisfy (blueprint: provider is swappable). */
export interface MapProvider {
  readonly name: string;
  geocode(query: string, near?: GeoPoint): Promise<Array<GeoPoint & { label: string }>>;
}
