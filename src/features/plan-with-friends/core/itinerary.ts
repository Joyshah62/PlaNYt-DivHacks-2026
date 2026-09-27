import type { StopInput } from "../bridge/index";
import { hashOf } from "./consensus";
import type { Point } from "./fairness";
import { MAX_DAY_STOPS } from "./types";

/** An itinerary someone arranged by hand; kept until someone regenerates. */
export interface StoredItinerary {
  order: string[];
  editedBy: string;
  editedAt: number;
  /** What the plan was built from, to tell when it's out of date. */
  basis: string;
}

export interface ItineraryState {
  keys: string[];
  manual: boolean;
  stale: boolean;
  editedBy: string | null;
  editedAt: number | null;
  /** Voted places that aren't in the day. */
  tray: string[];
}

interface Place {
  stop: StopInput;
  votes: string[];
}

export function basisOf(input: { ranking: [string, number][]; window: { from: number; to: number } | null; origin: Point | null }): string {
  return hashOf(input);
}

/** Most-voted first, adding each place while its visit and the trip there still fit the time the group has. */
export function autoPick(places: Place[], budgetMin: number, travel: (a: Point, b: Point) => number, origin: Point | null): string[] {
  const keys: string[] = [];
  let used = 0;
  let at = origin;
  for (const p of places) {
    if (keys.length >= MAX_DAY_STOPS) break;
    const cost = (at ? travel(at, p.stop) : 0) + p.stop.visitMin;
    if (used + cost > budgetMin) continue;
    keys.push(p.stop.key);
    used += cost;
    at = p.stop;
  }
  // With only big places, still plan the favourite rather than an empty day.
  if (!keys.length && places.length) keys.push(places[0].stop.key);
  return keys;
}

export function resolveItinerary(input: {
  places: Place[];
  stored: StoredItinerary | null;
  basis: string;
  budget: number;
  travel: (a: Point, b: Point) => number;
  origin: Point | null;
}): ItineraryState {
  const known = new Set(input.places.map((p) => p.stop.key));
  const keys = input.stored ? input.stored.order.filter((k) => known.has(k)).slice(0, MAX_DAY_STOPS) : autoPick(input.places, input.budget, input.travel, input.origin);
  const inDay = new Set(keys);
  return {
    keys,
    manual: !!input.stored,
    stale: !!input.stored && input.stored.basis !== input.basis,
    editedBy: input.stored?.editedBy ?? null,
    editedAt: input.stored?.editedAt ?? null,
    tray: input.places.map((p) => p.stop.key).filter((k) => !inDay.has(k)),
  };
}
