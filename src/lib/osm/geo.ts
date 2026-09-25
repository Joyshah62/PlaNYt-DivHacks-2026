import type { LatLon } from "./types";

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in meters. */
export function haversine(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Manhattan-grid streets make real paths longer than a straight line. 1.3x and a
 * relaxed 80 m/min walk is a conservative stand-in when routing is unavailable.
 */
const DETOUR = 1.3;
const WALK_M_PER_MIN = 80;
/** ~20 km/h: a free-flow-ish city average, deliberately not optimistic. */
const DRIVE_M_PER_MIN = 333;

export function estimateWalkMin(meters: number): number {
  return Math.max(1, Math.round((meters * DETOUR) / WALK_M_PER_MIN));
}

export function estimateDriveMin(meters: number): number {
  return Math.max(1, Math.round((meters * DETOUR) / DRIVE_M_PER_MIN));
}

/** ~50 minutes on foot; beyond this a walk time is noise, not information. */
export const WALKABLE_METERS = 4000;

export const METERS_PER_MILE = 1609.344;

/** Cache key that treats points ~10 m apart as the same place. */
export function pointKey({ lat, lon }: LatLon): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

/** Only answer for points in and around the five boroughs. */
export function inNycArea({ lat, lon }: LatLon): boolean {
  return lat > 40.45 && lat < 40.95 && lon > -74.3 && lon < -73.65;
}

export function parseLatLon(params: URLSearchParams): LatLon | null {
  const lat = Number.parseFloat(params.get("lat") ?? "");
  const lon = Number.parseFloat(params.get("lon") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const point = { lat, lon };
  return inNycArea(point) ? point : null;
}
