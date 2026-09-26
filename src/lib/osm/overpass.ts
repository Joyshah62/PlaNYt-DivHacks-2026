import { haversine } from "./geo";
import { USER_AGENT } from "./userAgent";
import type { LatLon } from "./types";

const OVERPASS = "https://overpass-api.de/api/interpreter";

export interface Eatery extends LatLon {
  id: string;
  name: string;
  /** "restaurant", "cafe" or "fast_food". */
  amenity: string;
  /** OSM's cuisine tag, first value, e.g. "pizza". */
  cuisine: string | null;
  meters: number;
}

/** Keyed by a ~100 m grid cell: the same area is asked for again whenever the day is re-planned. */
const cache = new Map<string, Eatery[]>();

/** Named places to eat within `radius` meters, nearest first. Empty when Overpass is unavailable. */
export async function nearbyEateries(point: LatLon, radius = 600): Promise<Eatery[]> {
  const key = `${point.lat.toFixed(3)},${point.lon.toFixed(3)},${radius}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const query = `[out:json][timeout:10];nwr(around:${radius},${point.lat},${point.lon})["amenity"~"^(restaurant|cafe|fast_food)$"]["name"];out center 150;`;
  try {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`Overpass responded ${res.status}`);
    const body = (await res.json()) as {
      elements: { type: string; id: number; lat?: number; lon?: number; center?: LatLon; tags?: Record<string, string> }[];
    };
    const out: Eatery[] = [];
    for (const el of body.elements) {
      const at = el.center ?? (el.lat !== undefined && el.lon !== undefined ? { lat: el.lat, lon: el.lon } : null);
      const tags = el.tags ?? {};
      if (!at || !tags.name) continue;
      out.push({
        id: `${el.type[0]}${el.id}`,
        name: tags.name,
        amenity: tags.amenity,
        cuisine: tags.cuisine?.split(";")[0].trim().replace(/_/g, " ") || null,
        lat: at.lat,
        lon: at.lon,
        meters: Math.round(haversine(point, at)),
      });
    }
    out.sort((a, b) => a.meters - b.meters);
    cache.set(key, out);
    return out;
  } catch (error) {
    console.error("[overpass]", error instanceof Error ? error.message : error);
    return [];
  }
}
