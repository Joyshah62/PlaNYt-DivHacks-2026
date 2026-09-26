/**
 * Address geocoding via NYC Planning's GeoSearch (Pelias). No API key required,
 * and it knows every address in the five boroughs.
 */

const GEOSEARCH = "https://geosearch.planninglabs.nyc/v2";

interface GeoFeature {
  geometry?: { coordinates?: [number, number] };
  properties: { label?: string; name?: string };
}

/** Any NYC address to a point: hotels, friends' places, a restaurant by street address. */
export async function geocodePoint(text: string): Promise<{ label: string; lat: number; lon: number } | null> {
  const res = await fetch(`${GEOSEARCH}/search?text=${encodeURIComponent(text)}&size=1`, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GeoSearch responded ${res.status}`);
  const match = ((await res.json()) as { features?: GeoFeature[] }).features?.[0];
  const [lon, lat] = match?.geometry?.coordinates ?? [];
  if (!match || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { label: match.properties.label ?? match.properties.name ?? text, lat: lat!, lon: lon! };
}
