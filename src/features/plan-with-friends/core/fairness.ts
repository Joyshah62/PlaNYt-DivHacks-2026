import type { PlanRequest } from "../bridge/index";

export interface Point {
  lat: number;
  lon: number;
}

export type TravelMinutes = (from: Point, to: Point) => number;

export interface FairPick {
  key: string;
  name: string;
  lat: number;
  lon: number;
  /** The longest anyone travels to get there. */
  worst: number;
  total: number;
  perMember: Record<string, number>;
}

/** Candidates whose key starts with this are meetup spots, not places to visit. */
export const MEETUP_PREFIX = "meetup-";

/** The place where the longest trip in is shortest; ties go to the least travel overall. */
export function fairestPoint(starts: Record<string, Point>, places: (Point & { key: string; name: string })[], travel: TravelMinutes): FairPick | null {
  const people = Object.entries(starts);
  if (!people.length || !places.length) return null;
  let best: FairPick | null = null;
  for (const place of places) {
    const perMember: Record<string, number> = {};
    let worst = 0;
    let total = 0;
    for (const [id, from] of people) {
      const minutes = Math.round(travel(from, place));
      perMember[id] = minutes;
      worst = Math.max(worst, minutes);
      total += minutes;
    }
    if (!best || worst < best.worst || (worst === best.worst && total < best.total)) {
      best = { key: place.key, name: place.name, lat: place.lat, lon: place.lon, worst, total, perMember };
    }
  }
  return best;
}

export function walkMinutes(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  const meters = Math.sqrt(x * x + y * y) * 6_371_000;
  // Streets aren't straight: ~1.25x the crow-flies distance at ~80 m a minute.
  return (meters * 1.25) / 80;
}

/** ~200 m grid: close enough to plan with, vague enough not to pin someone's front door. */
export function roundPoint(p: Point): Point {
  const snap = (v: number) => Math.round(v * 500) / 500;
  return { lat: Number(snap(p.lat).toFixed(3)), lon: Number(snap(p.lon).toFixed(3)) };
}

/** Where the group's day begins: a meetup spot they voted in, else the fairest stop. */
export function withGroupStart(request: PlanRequest, fairStop: FairPick | null): PlanRequest {
  const meetup = request.stops.find((s) => s.key.startsWith(MEETUP_PREFIX));
  if (meetup) {
    return { ...request, stops: request.stops.filter((s) => s !== meetup), origin: { label: meetup.name, lat: meetup.lat, lon: meetup.lon }, returnToOrigin: false };
  }
  if (!fairStop) return request;
  return { ...request, origin: { label: `Start at ${fairStop.name}`, lat: fairStop.lat, lon: fairStop.lon }, returnToOrigin: false };
}
