import type { OverpassElement } from "../categories";
import type { CommuteReport, LatLon, NearbyReport, Place, SourceStatus } from "../types";

/** 765 Lincoln Ave, Brooklyn - the same building the NYC fixtures use. */
export const CENTER: LatLon = { lat: 40.669958, lon: -73.864809 };

/** A trimmed, hand-checked slice of a real Overpass response for CENTER. */
export const ELEMENTS: OverpassElement[] = [
  { type: "node", id: 1, lat: 40.6754182, lon: -73.871912, tags: { name: "Euclid Avenue", railway: "station", station: "subway" } },
  // The same station mapped a second time, as OSM often does per line.
  { type: "node", id: 2, lat: 40.6755, lon: -73.8718, tags: { name: "Euclid Avenue", railway: "station", station: "subway" } },
  { type: "node", id: 3, lat: 40.6694, lon: -73.8648, tags: { highway: "bus_stop" } },
  { type: "way", id: 4, center: { lat: 40.6711, lon: -73.8627 }, tags: { name: "Food Bazaar", shop: "supermarket" } },
  { type: "node", id: 5, lat: 40.6721, lon: -73.8672, tags: { name: "Taj Mahal", amenity: "restaurant", cuisine: "indian;pakistani" } },
  { type: "node", id: 6, lat: 40.6689, lon: -73.8597, tags: { name: "Golden Wok", amenity: "fast_food", cuisine: "chinese" } },
  { type: "node", id: 7, lat: 40.6702, lon: -73.8702, tags: { name: "Crown Fried Chicken", amenity: "fast_food", cuisine: "chicken" } },
  { type: "node", id: 8, lat: 40.673, lon: -73.869, tags: { amenity: "restaurant", cuisine: "pizza" } },
  { type: "way", id: 9, center: { lat: 40.6682, lon: -73.8611 }, tags: { name: "Robert E Venable Park", leisure: "park" } },
  { type: "node", id: 10, lat: 40.6718, lon: -73.8579, tags: { name: "Planet Fitness", leisure: "fitness_centre" } },
  { type: "node", id: 11, lat: 40.6699, lon: -73.8651, tags: { name: "Corner Tap", amenity: "bar" } },
  { type: "node", id: 12, lat: 40.67, lon: -73.865, tags: { name: "Some Office", office: "company" } },
];

export function status(ok = true): SourceStatus {
  return { ok, source: "test", retrievedAt: ok ? "2026-06-15T12:00:00.000Z" : null, error: ok ? null : "down" };
}

export function place(overrides: Partial<Place> & Pick<Place, "id" | "category">): Place {
  return { name: overrides.id, cuisine: null, lat: CENTER.lat, lon: CENTER.lon, meters: 100, walkMin: 2, estimated: false, ...overrides };
}

export function nearby(places: Place[], ok = true): NearbyReport {
  return {
    center: CENTER,
    radiusMeters: 1200,
    categories: [],
    places,
    placesStatus: status(ok),
    routingStatus: status(ok),
    generatedAt: "2026-06-15T12:00:00.000Z",
  };
}

export function commute(rows: CommuteReport["rows"]): CommuteReport {
  return { center: CENTER, rows, unresolved: [], routingStatus: status(), generatedAt: "2026-06-15T12:00:00.000Z" };
}
