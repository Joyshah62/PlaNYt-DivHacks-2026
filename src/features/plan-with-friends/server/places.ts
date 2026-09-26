import { ATTRACTIONS, CATEGORY, nearestStations, parseOsmHours, type StopInput } from "../bridge/index";
import { readPoiRows } from "../bridge/server";
import { createPlaceIndex, type PlaceHit, type PoiRow } from "../core/placeSearch";

let index: Promise<ReturnType<typeof createPlaceIndex>> | null = null;

function placeIndex() {
  index ??= readPoiRows()
    .then((rows) =>
      createPlaceIndex(
        ATTRACTIONS,
        rows as PoiRow[],
        (c) => CATEGORY[c as keyof typeof CATEGORY] ?? { label: "Place", visitMin: 60 },
        (lat, lon) => {
          const [near] = nearestStations({ lat, lon }, 1, 1500);
          return near ? `near ${near.station.name.replace(/\s*\(.*\)$/, "")}` : null;
        },
      ),
    )
    .catch((error: unknown) => {
      index = null;
      throw error;
    });
  return index;
}

/** OSM often writes "Tu-We 17:00-22:30, Th-Sa …"; the parser expects ";" between day groups. */
const osmHours = (text: string) => parseOsmHours(text.replace(/,\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)\b)/g, "; "));

export type PlaceResult = PlaceHit & { stop: StopInput };

export async function searchPlaces(q: string, limit = 8): Promise<PlaceResult[]> {
  const hits = (await placeIndex()).search(q, limit);
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
