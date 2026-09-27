import { ATTRACTIONS, CATEGORY, nearestStations, parseOsmHours, STATIONS, type StopInput } from "../bridge/index";
import { readPoiRows } from "../bridge/server";
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

export async function searchPlaces(q: string, limit = 8, withStations = false): Promise<PlaceResult[]> {
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
