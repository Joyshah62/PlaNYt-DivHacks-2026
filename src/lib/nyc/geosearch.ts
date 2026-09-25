/**
 * Address resolution via NYC Planning's GeoSearch (Pelias). No API key required.
 * Returns the BBL/BIN that every downstream HPD query is keyed on.
 */

const GEOSEARCH = "https://geosearch.planninglabs.nyc/v2";

export interface ResolvedAddress {
  label: string;
  houseNumber: string | null;
  street: string | null;
  borough: string;
  zip: string | null;
  bbl: string;
  bin: string;
  /** WGS84 point of the address - the anchor for every neighborhood query. */
  lat: number | null;
  lon: number | null;
}

export interface Suggestion {
  label: string;
  bbl: string | null;
  bin: string | null;
}

interface GeoFeature {
  geometry?: { coordinates?: [number, number] };
  properties: {
    label?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    borough?: string;
    locality?: string;
    postalcode?: string;
    addendum?: { pad?: { bbl?: string; bin?: string } };
  };
}

/**
 * Borough-level placeholder BINs (1000000, 2000000, ...). HPD attaches records it
 * can't pin to a real building to these, so bin 3000000 looks like one of the worst
 * buildings in the city. Always reject them.
 */
export function isPlaceholderBin(bin: string | null | undefined): boolean {
  return !bin || /^[1-5]000000$/.test(bin);
}

export class AddressNotFoundError extends Error {}

async function geosearch(path: string): Promise<GeoFeature[]> {
  const res = await fetch(`${GEOSEARCH}${path}`, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GeoSearch responded ${res.status}`);
  const body = (await res.json()) as { features?: GeoFeature[] };
  return body.features ?? [];
}

export async function resolveAddress(address: string): Promise<ResolvedAddress> {
  const features = await geosearch(
    `/search?text=${encodeURIComponent(address)}&size=5`,
  );

  // Take the best match that actually carries building identifiers.
  const match = features.find((f) => {
    const pad = f.properties.addendum?.pad;
    return pad?.bbl && !isPlaceholderBin(pad.bin);
  });

  if (!match) throw new AddressNotFoundError(address);

  const p = match.properties;
  const pad = p.addendum!.pad!;
  const [lon, lat] = match.geometry?.coordinates ?? [];

  return {
    label: p.name ?? p.label ?? address,
    houseNumber: p.housenumber ?? null,
    street: p.street ?? null,
    borough: p.borough ?? p.locality ?? "New York",
    zip: p.postalcode ?? null,
    bbl: pad.bbl!,
    bin: pad.bin!,
    lat: Number.isFinite(lat) ? lat! : null,
    lon: Number.isFinite(lon) ? lon! : null,
  };
}

/** Type-ahead for the search box. */
export async function suggestAddresses(text: string): Promise<Suggestion[]> {
  if (text.trim().length < 3) return [];
  const features = await geosearch(
    `/autocomplete?text=${encodeURIComponent(text)}&size=6`,
  );
  return features
    .filter((f) => f.properties.addendum?.pad?.bbl)
    .map((f) => ({
      label: f.properties.label ?? f.properties.name ?? "",
      bbl: f.properties.addendum?.pad?.bbl ?? null,
      bin: f.properties.addendum?.pad?.bin ?? null,
    }));
}

/**
 * Any NYC address to a point, without requiring building identifiers. Used for
 * the reader's own destinations ("where I work"), which need not be residential.
 */
export async function geocodePoint(
  text: string,
): Promise<{ label: string; lat: number; lon: number } | null> {
  const features = await geosearch(`/search?text=${encodeURIComponent(text)}&size=1`);
  const match = features[0];
  const [lon, lat] = match?.geometry?.coordinates ?? [];
  if (!match || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { label: match.properties.label ?? match.properties.name ?? text, lat: lat!, lon: lon! };
}
