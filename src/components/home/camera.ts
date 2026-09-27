export interface LatLng {
  lat: number;
  lng: number;
}

/** A Google-style 3D camera: look at (lat, lng, alt metres) from `range` metres away. */
export interface Camera extends LatLng {
  alt: number;
  range: number;
  tilt: number;
  heading: number;
}

/** MapLibre zoom that frames roughly what a Google 3D camera at `range` metres shows (400 m ≈ zoom 16). */
export function rangeToZoom(range: number): number {
  return Math.max(0, Math.min(20, 16 - Math.log2(range / 400)));
}

/** The Google 3D range that frames what MapLibre shows at `zoom`: the inverse of `rangeToZoom`. */
export function zoomToRange(zoom: number): number {
  return 400 * 2 ** (16 - zoom);
}

export function formatTicker(lat: number, lng: number, heading: number): string {
  const h = Math.round(((heading % 360) + 360) % 360) % 360;
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"} · Heading ${String(h).padStart(3, "0")}°`;
}

// Both engines draw about a 35° vertical field of view; keep stops inside 90% of it.
const HALF_FOV = ((35 / 2) * 0.9 * Math.PI) / 180;

/** Whether every point within `r` metres of the target stays in view, at any heading. */
function holds(range: number, r: number, tilt: number, aspect: number): boolean {
  const t = (tilt * Math.PI) / 180;
  const up = range * Math.cos(t);
  const back = range * Math.sin(t);
  const centre = Math.PI / 2 - t; // how far below the horizon the camera looks
  const near = back > r ? Math.atan2(up, back - r) : Math.PI / 2;
  const far = Math.atan2(up, back + r);
  const halfWidth = Math.atan(Math.tan(HALF_FOV) * aspect);
  return near - centre <= HALF_FOV && centre - far <= HALF_FOV && Math.atan(r / range) <= halfWidth;
}

/**
 * `base` re-centred on `stops` and pulled back just far enough that every stop stays in a
 * `width` × `height` view at any heading, so an orbit never turns one out of frame. MapLibre
 * sizes its view by pixels rather than angle (`rangeToZoom` matches Google at ~880px tall), so
 * `pixelScaled` pulls back further on shorter maps.
 */
export function fitStops(stops: LatLng[], base: Camera, width: number, height: number, pixelScaled = false): Camera {
  if (!stops.length || width <= 0 || height <= 0) return base;
  const lats = stops.map((s) => s.lat);
  const lngs = stops.map((s) => s.lng);
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const mLat = 111_320;
  const mLng = mLat * Math.cos((lat * Math.PI) / 180);
  const r = Math.max(100, ...stops.map((s) => Math.hypot((s.lat - lat) * mLat, (s.lng - lng) * mLng)));
  let [lo, hi] = [r, r * 40];
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (holds(mid, r, base.tilt, width / height)) hi = mid;
    else lo = mid;
  }
  return { ...base, lat, lng, range: hi * (pixelScaled ? Math.max(1, 880 / height) : 1) };
}

/** `steps` evenly spaced points from a (exclusive) to b (inclusive). */
export function interpolate(a: LatLng, b: LatLng, steps: number): LatLng[] {
  return Array.from({ length: steps }, (_, k) => {
    const t = (k + 1) / steps;
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  });
}

/** The whole straight-leg route through `stops`, `steps` points per leg. */
export function routePath(stops: LatLng[], steps: number): LatLng[] {
  if (!stops.length) return [];
  return [{ lat: stops[0].lat, lng: stops[0].lng }, ...stops.slice(1).flatMap((s, i) => interpolate(stops[i], s, steps))];
}
