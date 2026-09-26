/**
 * Shapes shared by routing (OSRM) and geocoding. Every time here is a route
 * *estimate*: OSRM on OpenStreetMap roads, with no live traffic.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export interface RouteResult {
  /** [lon, lat] pairs, origin first. */
  coordinates: [number, number][];
  minutes: number;
  meters: number;
}
