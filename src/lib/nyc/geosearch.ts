/**
 * Address geocoding via NYC Planning's GeoSearch (Pelias). No API key required,
 * and it knows every address in the five boroughs.
 */

const GEOSEARCH = "https://geosearch.planninglabs.nyc/v2";

interface GeoFeature {
  geometry?: { coordinates?: [number, number] };
  properties: { label?: string; name?: string; neighbourhood?: string; borough?: string; postalcode?: string };
}

export interface AddressMatch {
  name: string;
  area: string;
  lat: number;
  lon: number;
}

/** "554W 148th St" reads as one word to GeoSearch; "554 W 148th St" matches. */
const spaced = (text: string) => text.trim().replace(/^(\d+[a-z]?)(?=[nsew]\b|north|south|east|west)/i, "$1 ");
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Addresses as someone types one, best match first. */
export async function suggestAddresses(text: string, size = 4): Promise<AddressMatch[]> {
  const res = await fetch(`${GEOSEARCH}/autocomplete?text=${encodeURIComponent(spaced(text))}`, {
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GeoSearch responded ${res.status}`);
  const features = ((await res.json()) as { features?: GeoFeature[] }).features ?? [];
  return features.slice(0, size).flatMap(({ geometry, properties: p }) => {
    const [lon, lat] = geometry?.coordinates ?? [];
    if (!p.name || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const area = [p.neighbourhood, p.borough, p.postalcode].filter(Boolean).join(", ");
    return [{ name: titleCase(p.name), area, lat: lat!, lon: lon! }];
  });
}

/** Any NYC address to a point: hotels, friends' places, a restaurant by street address. */
export async function geocodePoint(text: string): Promise<{ label: string; lat: number; lon: number } | null> {
  const res = await fetch(`${GEOSEARCH}/search?text=${encodeURIComponent(spaced(text))}&size=1`, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GeoSearch responded ${res.status}`);
  const match = ((await res.json()) as { features?: GeoFeature[] }).features?.[0];
  const [lon, lat] = match?.geometry?.coordinates ?? [];
  if (!match || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { label: match.properties.label ?? match.properties.name ?? text, lat: lat!, lon: lon! };
}
