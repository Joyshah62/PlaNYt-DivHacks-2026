import { ATTRACTION_BY_ID } from "./attractions";
import type { DayPlan, LegMode } from "./types";

/**
 * Google Maps URLs (the documented `maps/dir` and `maps/search` forms). They
 * need no API key and cost nothing: the reader's own Maps app does the routing,
 * with live transit times we can't offer.
 */

/** A catalog place by name (Maps shows the real listing); anything else by its coordinates. */
export interface MapsPoint {
  query: string;
}

export function mapsPoint(p: { lat: number; lon: number; attractionId?: string | null; label?: string }): MapsPoint {
  const known = p.attractionId ? ATTRACTION_BY_ID.get(p.attractionId) : undefined;
  return { query: known ? `${known.name}, ${known.area}, New York, NY` : `${p.lat.toFixed(6)},${p.lon.toFixed(6)}` };
}

const TRAVEL_MODE: Record<LegMode, string> = { walk: "walking", subway: "transit", bike: "bicycling", car: "driving", taxi: "driving" };

export function mapsDirections(from: MapsPoint, to: MapsPoint, mode: LegMode): string {
  const params = new URLSearchParams({ api: "1", origin: from.query, destination: to.query, travelmode: TRAVEL_MODE[mode] });
  return `https://www.google.com/maps/dir/?${params}`;
}

/**
 * The whole day as one multi-stop route. Google doesn't take waypoints for
 * transit, so subway days get per-leg links only; the URL form allows up to
 * nine waypoints between origin and destination.
 */
export function mapsDayRoute(plan: DayPlan): string | null {
  if (plan.request.mode === "transit") return null;
  const points = [
    ...(plan.request.origin ? [mapsPoint(plan.request.origin)] : []),
    ...plan.stops.map(mapsPoint),
    ...(plan.returnLeg && plan.request.origin ? [mapsPoint(plan.request.origin)] : []),
  ];
  if (points.length < 2 || points.length > 11) return null;
  const params = new URLSearchParams({
    api: "1",
    origin: points[0].query,
    destination: points[points.length - 1].query,
    travelmode: TRAVEL_MODE[plan.request.mode],
  });
  const waypoints = points.slice(1, -1).map((p) => p.query);
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}
