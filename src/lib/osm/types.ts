/**
 * Shapes shared by the neighborhood (Overpass) and commute (OSRM) reports.
 *
 * Every time here is a route *estimate*: OSRM walking/driving on OpenStreetMap
 * roads, with no live traffic and no transit. Where OSRM could not answer we fall
 * back to straight-line math and flag the value `estimated` so the UI can say so.
 */

export type CategoryId =
  | "groceries"
  | "convenience"
  | "restaurants"
  | "coffee"
  | "nightlife"
  | "pharmacy"
  | "fitness"
  | "parks"
  | "subway"
  | "bus"
  | "health"
  | "entertainment"
  | "laundry";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Place extends LatLon {
  /** OSM element id, e.g. "node/591994312". */
  id: string;
  name: string;
  category: CategoryId;
  /** Normalized cuisine bucket for restaurants, otherwise null. */
  cuisine: string | null;
  /** Straight-line distance from the apartment. */
  meters: number;
  /** Walking minutes: OSRM for the nearest few per category, otherwise estimated. */
  walkMin: number;
  /** True when walkMin came from straight-line math rather than a routed path. */
  estimated: boolean;
  /** OSM details, only when mapped. Shown in the place card. */
  hours?: string;
  website?: string;
  phone?: string;
  street?: string;
}

/** Whether an upstream answered - kept separate from "answered with nothing". */
export interface SourceStatus {
  ok: boolean;
  source: string;
  retrievedAt: string | null;
  error: string | null;
}

export interface CuisineCount {
  cuisine: string;
  count: number;
}

export interface CategorySummary {
  id: CategoryId;
  within5: number;
  within10: number;
  within15: number;
  /** The closest few, routed. */
  nearest: Place[];
  /** Restaurants only: counts within a 15-minute walk, largest first. */
  cuisines: CuisineCount[];
}

export interface NearbyReport {
  center: LatLon;
  radiusMeters: number;
  categories: CategorySummary[];
  /** Every place within the radius, for map pins. */
  places: Place[];
  placesStatus: SourceStatus;
  routingStatus: SourceStatus;
  generatedAt: string;
}

export type DestinationKind = "work" | "school" | "other" | "preset";

export interface CommuteRow extends LatLon {
  id: string;
  label: string;
  kind: DestinationKind;
  /** Null when neither routing nor an estimate is available for that mode. */
  walkMin: number | null;
  driveMin: number | null;
  driveMiles: number | null;
  /** Straight-line fallback was used for at least one mode. */
  estimated: boolean;
}

export interface CommuteReport {
  center: LatLon;
  rows: CommuteRow[];
  /** Custom destinations we could not place on the map. */
  unresolved: string[];
  routingStatus: SourceStatus;
  generatedAt: string;
}

export interface RouteResult {
  /** [lon, lat] pairs, apartment first. */
  coordinates: [number, number][];
  minutes: number;
  meters: number;
}
