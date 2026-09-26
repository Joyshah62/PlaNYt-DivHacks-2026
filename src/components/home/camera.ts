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

export function formatTicker(lat: number, lng: number, heading: number): string {
  const h = Math.round(((heading % 360) + 360) % 360) % 360;
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"} · Heading ${String(h).padStart(3, "0")}°`;
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
