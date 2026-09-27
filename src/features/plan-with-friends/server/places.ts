import { ATTRACTIONS, CATEGORY, parseOsmHours, type StopInput } from "../bridge/index";
import { nearestStations, readPoiRows, STATIONS, suggestAddresses } from "../bridge/server";
import { createPlaceIndex, type PlaceHit, type PoiRow } from "../core/placeSearch";

type Index = ReturnType<typeof createPlaceIndex>;
const indexes = new Map<string, Promise<Index>>();

const labelFor = (c: string) => (c === "station" ? { label: "Subway station", visitMin: 10 } : (CATEGORY[c as keyof typeof CATEGORY] ?? { label: "Place", visitMin: 60 }));
const nearStation = (lat: number, lon: number) => {
  const [near] = nearestStations({ lat, lon }, 1, 1500);
  return near ? `near ${near.station.name.replace(/\s*\(.*\)$/, "")}` : null;
};

/** Places to visit; with stations too when someone is picking where they start from. */
function placeIndex(withStations: boolean): Promise<Index> {
  const key = withStations ? "start" : "visit";
  let index = indexes.get(key);
  if (!index) {
    index = readPoiRows()
      .then((rows) => {
        const stationRows: PoiRow[] = withStations
          ? STATIONS.map((s) => [`st${s.id}`, s.name.replace(/\s*\(.*\)$/, ""), s.lat, s.lon, "station", "station", null, null, null, s.borough])
          : [];
        return createPlaceIndex(ATTRACTIONS, [...stationRows, ...(rows as PoiRow[])], labelFor, nearStation);
      })
      .catch((error: unknown) => {
        indexes.delete(key);
        throw error;
      });
    indexes.set(key, index);
  }
  return index;
}

/** OSM often writes "Tu-We 17:00-22:30, Th-Sa …"; the parser expects ";" between day groups. */
const osmHours = (text: string) => parseOsmHours(text.replace(/,\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)\b)/g, "; "));

export type PlaceResult = PlaceHit & { stop: StopInput };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Street addresses matching what's typed, as places you can pick. */
async function searchAddresses(q: string, limit: number): Promise<PlaceResult[]> {
  const found = await suggestAddresses(q, limit).catch((error: unknown) => {
    console.error("[trips/places]", error instanceof Error ? error.message : error);
    return [];
  });
  return found.map((a) => {
    const key = `addr-${slug(a.name)}`.slice(0, 80);
    const hit = { key, name: a.name, lat: a.lat, lon: a.lon, detail: ["Address", a.area].filter(Boolean).join(" · "), visitMin: 60, hoursText: null, source: "address" as const, attractionId: null };
    return { ...hit, stop: { key, name: a.name.slice(0, 120), lat: a.lat, lon: a.lon, visitMin: 60, attractionId: null } };
  });
}

/** Named places as you type; a query starting with a number ("554 W 148th") is an address, so addresses come first. */
export async function searchPlaces(q: string, limit = 8, withStations = false): Promise<PlaceResult[]> {
  if (!/^\s*\d/.test(q)) return searchNamed(q, limit, withStations);
  const [addresses, named] = await Promise.all([searchAddresses(q, 4), searchNamed(q, limit, withStations)]);
  return [...addresses, ...named].slice(0, limit);
}

async function searchNamed(q: string, limit: number, withStations: boolean): Promise<PlaceResult[]> {
  const hits = (await placeIndex(withStations)).search(q, limit);
  return hits.map((h) => ({
    ...h,
    stop: {
      key: h.key.slice(0, 80),
      name: h.name.slice(0, 120),
      lat: h.lat,
      lon: h.lon,
      visitMin: h.visitMin,
      attractionId: h.attractionId,
      ...(h.hoursText ? { hours: osmHours(h.hoursText) } : {}),
    },
  }));
}
