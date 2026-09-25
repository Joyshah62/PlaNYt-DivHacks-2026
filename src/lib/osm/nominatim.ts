import { geocodePoint } from "@/lib/nyc/geosearch";
import { USER_AGENT } from "./overpass";
import { findKnownDestination } from "./places";
import type { LatLon } from "./types";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/** Five-borough bounding box: left, top, right, bottom. */
const NYC_VIEWBOX = "-74.26,40.92,-73.68,40.48";

export interface ResolvedPoint extends LatLon {
  label: string;
}

/** Nominatim's usage policy asks for at most one request a second, cached. */
const cache = new Map<string, ResolvedPoint | null>();
let lastCall = 0;

async function nominatim(text: string): Promise<ResolvedPoint | null> {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const params = new URLSearchParams({
    q: text,
    format: "jsonv2",
    limit: "1",
    viewbox: NYC_VIEWBOX,
    bounded: "1",
    countrycodes: "us",
  });
  const res = await fetch(`${NOMINATIM}?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
  const [hit] = (await res.json()) as { lat: string; lon: string; name?: string; display_name?: string }[];
  if (!hit) return null;
  return {
    label: hit.name || hit.display_name?.split(",")[0] || text,
    lat: Number.parseFloat(hit.lat),
    lon: Number.parseFloat(hit.lon),
  };
}

/**
 * A reader's destination, however they typed it. Street addresses (leading
 * number) go to NYC GeoSearch first - it knows every NYC address. Names like
 * "Columbia University" go to Nominatim first - it knows places.
 */
export async function resolveDestination(text: string): Promise<ResolvedPoint | null> {
  const known = findKnownDestination(text);
  if (known) return { label: known.label, lat: known.lat, lon: known.lon };

  const key = text.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const looksLikeAddress = /^\d/.test(text.trim());
  const order = looksLikeAddress
    ? [() => geocodePoint(text), () => nominatim(text)]
    : [() => nominatim(text), () => geocodePoint(text)];

  let result: ResolvedPoint | null = null;
  let failed = false;
  for (const attempt of order) {
    try {
      result = await attempt();
      if (result) break;
    } catch (error) {
      failed = true;
      console.error("[geocode]", error instanceof Error ? error.message : error);
    }
  }

  // GeoSearch keeps its own addresses' labels; keep what the reader typed for names.
  if (result && !looksLikeAddress) result = { ...result, label: text.trim() };
  // An outage is not "no such place" - only remember real answers.
  if (result || !failed) cache.set(key, result);
  return result;
}
