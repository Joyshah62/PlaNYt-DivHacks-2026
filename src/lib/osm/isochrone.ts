import { USER_AGENT } from "./overpass";
import type { LatLon } from "./types";

/** FOSSGIS-hosted Valhalla: real walking-time areas along the street network. */
const VALHALLA = "https://valhalla1.openstreetmap.de/isochrone";

export const ISOCHRONE_MINUTES = [5, 10, 15] as const;

export type IsochroneCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { min: number }>;

/** Largest first, so smaller areas draw on top. Null when the service is unavailable. */
export async function fetchIsochrones(center: LatLon): Promise<IsochroneCollection | null> {
  const body = {
    locations: [{ lat: center.lat, lon: center.lon }],
    costing: "pedestrian",
    contours: ISOCHRONE_MINUTES.map((time) => ({ time })),
    polygons: true,
    denoise: 0.3,
    generalize: 20,
  };
  try {
    const res = await fetch(`${VALHALLA}?json=${encodeURIComponent(JSON.stringify(body))}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Valhalla responded ${res.status}`);
    const json = (await res.json()) as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { contour?: number }>;
    const features = json.features
      .filter((f) => typeof f.properties?.contour === "number")
      .map((f) => ({ type: "Feature" as const, geometry: f.geometry, properties: { min: f.properties!.contour! } }))
      .sort((a, b) => b.properties.min - a.properties.min);
    return features.length ? { type: "FeatureCollection", features } : null;
  } catch (error) {
    console.error("[isochrone]", error instanceof Error ? error.message : error);
    return null;
  }
}
