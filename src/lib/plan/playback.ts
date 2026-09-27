import { isMealBreak } from "./profile";
import type { DayPlan } from "./types";

type Coord = [lon: number, lat: number];

/** One stretch of the day: moving along a path, or staying at a stop. */
export interface Segment {
  from: number;
  to: number;
  /** The stop being visited; null while travelling. */
  key: string | null;
  /** Where the next stop is, while travelling to it. */
  toward: string | null;
  label: string;
  path: Coord[];
}

export interface Timeline {
  startMin: number;
  endMin: number;
  segments: Segment[];
}

export interface Position {
  at: Coord;
  key: string | null;
  label: string;
  /** Everything travelled so far, as one line per leg. */
  trail: Coord[][];
}

const VERB = { walk: "Walking", subway: "Subway", bike: "Cycling", car: "Driving", taxi: "Taxi" } as const;

/**
 * The day as a sequence of moves and stays, in minutes, following the drawn
 * legs (keyed by the stop they arrive at, or "return"). Meal breaks happen
 * where the traveler already is.
 */
export function buildTimeline(plan: DayPlan, legs: { key: string; coordinates: Coord[] }[]): Timeline {
  const path = new Map(legs.map((l) => [l.key, l.coordinates]));
  const segments: Segment[] = [];
  let here: Coord | null = plan.request.origin ? [plan.request.origin.lon, plan.request.origin.lat] : null;
  let clock = plan.stops[0] ? plan.stops[0].arriveMin - (plan.stops[0].leg?.minutes ?? 0) : plan.request.startMin;
  const startMin = clock;

  for (const s of plan.stops) {
    const at: Coord = isMealBreak(s) ? (here ?? [s.lon, s.lat]) : [s.lon, s.lat];
    if (s.leg && here) {
      const from = s.arriveMin - s.leg.minutes;
      segments.push({ from, to: s.arriveMin, key: null, toward: s.key, label: `${VERB[s.leg.mode]} to ${s.name}`, path: path.get(s.key) ?? [here, at] });
    }
    segments.push({ from: s.arriveMin, to: s.endMin, key: s.key, toward: null, label: isMealBreak(s) ? `${s.name} break` : `At ${s.name}`, path: [at] });
    here = at;
    clock = s.endMin;
  }
  if (plan.returnLeg && plan.request.origin && here) {
    const home: Coord = [plan.request.origin.lon, plan.request.origin.lat];
    segments.push({ from: clock, to: clock + plan.returnLeg.minutes, key: null, toward: null, label: `Back to ${plan.request.origin.label}`, path: path.get("return") ?? [here, home] });
    clock += plan.returnLeg.minutes;
  }
  return { startMin, endMin: Math.max(clock, startMin + 1), segments };
}

/** Planar length is fine at city scale once longitude is scaled by latitude. */
function dist(a: Coord, b: Coord): number {
  const k = Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * k, a[1] - b[1]);
}

/** The point `f` (0..1) of the way along a path, and the path up to it. */
export function along(path: Coord[], f: number): { at: Coord; done: Coord[] } {
  if (path.length === 1 || f <= 0) return { at: path[0], done: [path[0]] };
  const lengths = path.slice(1).map((p, i) => dist(path[i], p));
  const total = lengths.reduce((a, b) => a + b, 0);
  let left = Math.min(1, f) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] ? Math.min(1, left / lengths[i]) : 1;
      const a = path[i];
      const b = path[i + 1];
      const at: Coord = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      return { at, done: [...path.slice(0, i + 1), at] };
    }
    left -= lengths[i];
  }
  return { at: path[path.length - 1], done: path };
}

export function positionAt(timeline: Timeline, t: number): Position | null {
  const { segments } = timeline;
  if (!segments.length) return null;
  const trail: Coord[][] = [];
  for (const seg of segments) {
    if (t >= seg.to) {
      if (seg.key === null) trail.push(seg.path);
      continue;
    }
    if (t < seg.from) {
      // A gap (waiting to leave): stay where the last segment ended.
      const prev = segments[segments.indexOf(seg) - 1];
      const at = prev ? prev.path[prev.path.length - 1] : seg.path[0];
      return { at, key: prev?.key ?? null, label: prev?.label ?? seg.label, trail };
    }
    const { at, done } = along(seg.path, (t - seg.from) / Math.max(1, seg.to - seg.from));
    if (seg.key === null) trail.push(done);
    return { at, key: seg.key ?? seg.toward, label: seg.label, trail };
  }
  const last = segments[segments.length - 1];
  return { at: last.path[last.path.length - 1], key: last.key, label: "Day done", trail };
}
