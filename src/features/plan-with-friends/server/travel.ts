import { nearestStations, STATIONS, subwayLeg } from "../bridge/server";
import { fairestPoint, MEETUP_PREFIX, walkMinutes, type FairPick, type Point } from "../core/fairness";

/** Door to door by subway or on foot, whichever is quicker. No network: safe to run on every read. */
export function groupTravel(from: Point, to: Point): number {
  return Math.min(subwayLeg(from, to)?.minutes ?? Infinity, walkMinutes(from, to));
}

const cleanName = (name: string) => name.replace(/\s*\(.*\)$/, "");

export function areaLabel(p: Point): string {
  const [near] = nearestStations(p, 1, 2000);
  return near ? `near ${cleanName(near.station.name)}` : "somewhere in NYC";
}

const cache = new Map<string, FairPick | null>();

/** The subway station where nobody's trip in is long. Only stations near the group's middle are tried. */
export function fairestMeetup(starts: Record<string, Point>): FairPick | null {
  const points = Object.values(starts);
  if (points.length < 2) return null;
  const key = JSON.stringify(Object.entries(starts).sort());
  if (cache.has(key)) return cache.get(key)!;
  const middle = { lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lon: points.reduce((s, p) => s + p.lon, 0) / points.length };
  const nearby = nearestStations(middle, 40).map(({ station }) => ({ key: `${MEETUP_PREFIX}${station.id}`, name: `Meet at ${cleanName(station.name)}`, lat: station.lat, lon: station.lon }));
  const pick = fairestPoint(starts, nearby.length ? nearby : STATIONS.slice(0, 1).map((s) => ({ key: `${MEETUP_PREFIX}${s.id}`, name: `Meet at ${cleanName(s.name)}`, lat: s.lat, lon: s.lon })), groupTravel);
  if (cache.size > 200) cache.clear();
  cache.set(key, pick);
  return pick;
}
