import { haversine, inNycArea } from "@/lib/osm/geo";
import { resolveDestination } from "@/lib/osm/nominatim";
import { windowOn } from "@/lib/plan/attractions";
import { buildPlan } from "@/lib/plan/build";
import { sharedLegs } from "@/lib/plan/compare";
import type { CrowdBand } from "@/lib/plan/crowd";
import { isMealBreak, MEAL_WINDOW } from "@/lib/plan/profile";
import { clock, duration } from "@/lib/plan/time";
import type { DayPlan, MealKind, PlanRequest, StopInput } from "@/lib/plan/types";
import { CATEGORY } from "./categories";
import type { SearchPoint } from "./sources";
import type { Area, Candidate, Intent, Result } from "./types";

/** How many candidates are tried in the full day. Each is a whole re-plan, on one shared travel matrix. */
const TRY = 12;
const SHOW = 6;

// --- where to look ------------------------------------------------------------------

export async function resolveArea(area: Area, plan: DayPlan, focus: string | null = null): Promise<{ points: SearchPoint[]; label: string } | null> {
  const places = plan.stops.filter((s) => !isMealBreak(s));
  switch (area.kind) {
    case "stop": {
      const s = places.find((x) => x.key === area.stopKey);
      return s ? { points: [{ lat: s.lat, lon: s.lon, radius: 900 }], label: `Near ${s.name}` } : null;
    }
    case "origin":
      return plan.request.origin ? { points: [{ lat: plan.request.origin.lat, lon: plan.request.origin.lon, radius: 900 }], label: `Near ${plan.request.origin.label}` } : null;
    case "here":
      return area.lat !== undefined && area.lon !== undefined && inNycArea({ lat: area.lat, lon: area.lon })
        ? { points: [{ lat: area.lat, lon: area.lon, radius: 900 }], label: "Near you" }
        : null;
    case "neighborhood": {
      const p = area.neighborhood ? await resolveDestination(`${area.neighborhood}, New York`) : null;
      return p && inNycArea(p) ? { points: [{ lat: p.lat, lon: p.lon, radius: 1100 }], label: `In ${area.neighborhood}` } : null;
    }
    case "trip": {
      // Every place in the day, plus the start; a few more on long legs so "along the way" means it.
      const origin = plan.request.origin;
      // Wider around a stop the words named ("after the Met") and the one after it.
      const at = focus ? places.findIndex((s) => s.key === focus) : -1;
      const radius = (i: number) => (at >= 0 && (i === at || i === at + 1) ? 1100 : 600);
      const points: SearchPoint[] = [...(origin ? [{ lat: origin.lat, lon: origin.lon, radius: 600 }] : []), ...places.map((s, i) => ({ lat: s.lat, lon: s.lon, radius: radius(i) }))];
      for (let i = 1; i < places.length; i++) {
        const a = places[i - 1];
        const b = places[i];
        if (haversine(a, b) > 1800) points.push({ lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2, radius: 600 });
      }
      return points.length ? { points: points.slice(0, 9), label: "Along your trip" } : null;
    }
  }
}

// --- evidence and scoring -----------------------------------------------------------------

/** "4.6★ from 1,240 reviews", only when a source gave both. */
export function ratingText(c: Pick<Candidate, "rating" | "reviews">): string | null {
  if (c.rating === null || !c.reviews) return null;
  return `${c.rating.toFixed(1)}★ from ${c.reviews.toLocaleString("en-US")} ${c.reviews === 1 ? "review" : "reviews"}`;
}

/**
 * A rating pulled toward 4.0 when it rests on few reviews: 5.0 from 3 reviews
 * says less than 4.6 from 2,000. Null without a rating.
 */
export function weightedRating(c: Pick<Candidate, "rating" | "reviews">): number | null {
  if (c.rating === null || !c.reviews) return null;
  const prior = 30;
  return (c.rating * c.reviews + 4.0 * prior) / (c.reviews + prior);
}

const CROWD_COST: Record<CrowdBand, number> = { quiet: 0, moderate: 6, busy: 14, peak: 22 };

/** Lower is better. Every term is a number the card can show. */
export function scoreOf(r: Pick<Result, "travelDelta" | "overDelta" | "conflicts" | "closed" | "crowdBand" | "meters" | "price" | "rating" | "reviews" | "after">, intent: Intent, matched: number, afterKey: string | null): number {
  const weighted = weightedRating(r);
  let score = Math.max(0, r.travelDelta) + Math.max(0, r.overDelta) * 1.5 + r.conflicts.length * 45 + (r.closed ? 1000 : 0);
  score -= weighted === null ? 0 : (weighted - 4.0) * (intent.sort === "rating" ? 60 : 25);
  if (intent.sort === "rating" && weighted === null) score += 12;
  score -= matched * 10;
  if (intent.quiet && r.crowdBand) score += CROWD_COST[r.crowdBand];
  if (intent.sort === "closer") score += r.meters / 25;
  if (intent.price === "cheap" || intent.sort === "cheaper") score += r.price === null ? 6 : (r.price - 1) * (intent.sort === "cheaper" ? 16 : 8);
  if (intent.price === "upscale") score += r.price === null ? 6 : (4 - r.price) * 6;
  if (intent.after && afterKey !== intent.after) score += 20;
  return score;
}

/** How many of the asked-for words a place matches: cuisine tag or name. */
function matchCount(c: Candidate, intent: Intent): number {
  const hay = `${c.name} ${c.cuisine ?? ""} ${c.kind}`.toLowerCase();
  return [intent.cuisine, ...intent.keywords].filter((w): w is string => Boolean(w) && hay.includes(w!)).length;
}

// --- trying candidates in the day ---------------------------------------------------------

/** Which meal this could be: asked for, or a restaurant when the day has a floating meal break. */
function mealFor(intent: Intent, base: DayPlan, food: boolean): MealKind | null {
  if (!food) return null;
  const breaks = base.stops.filter(isMealBreak).map((s) => s.meal!);
  if (intent.meal) return breaks.includes(intent.meal) ? intent.meal : null;
  return intent.category === "restaurant" ? (breaks[0] ?? null) : null;
}

export async function evaluate(request: PlanRequest, candidates: Candidate[], intent: Intent, preferredStartMin: number | null = null): Promise<Result[]> {
  const def = CATEGORY[intent.category];
  // Cheap first pass: close, matching, well-evidenced places get tried in the day.
  const pre = candidates
    .filter((c) => !request.stops.some((s) => s.name.toLowerCase() === c.name.toLowerCase()))
    .filter((c) => intent.minRating === null || c.rating === null || c.rating >= intent.minRating)
    .map((c) => ({ c, pre: c.meters / 60 - matchCount(c, intent) * 8 - ((weightedRating(c) ?? 4) - 4) * 20 + (c.hours ? 0 : 2) }))
    .sort((a, b) => a.pre - b.pre)
    .slice(0, TRY)
    .map((x) => x.c);
  if (!pre.length) return [];

  const legSource = sharedLegs(request, pre);
  // The day as it stands, in its planned order. A new place is slotted into that
  // order where it costs least, and the rest of the day keeps its shape: so the
  // card's numbers are the new place's own, and exactly what "Add" will plan.
  const shown = await buildPlan(request, legSource);
  const order = shown.stops.filter((s) => !isMealBreak(s)).map((s) => request.stops.find((x) => x.key === s.key)!).filter(Boolean);
  const closedStops = request.stops.filter((s) => shown.skipped.some((k) => k.key === s.key));
  const ordered = [...order, ...closedStops];
  const base = await buildPlan({ ...request, stops: ordered, keepOrder: true }, legSource);
  const baseIssue = new Map(base.stops.map((s) => [s.key, s.issue]));
  const replaceStop = intent.replace ? request.stops.find((s) => s.key === intent.replace) : undefined;
  const meal = replaceStop ? null : mealFor(intent, base, def.food);

  const results = await Promise.all(
    pre.map(async (c): Promise<Result> => {
      const stop: StopInput = {
        key: `find-${c.id}`.slice(0, 80),
        name: c.name.slice(0, 120),
        lat: c.lat,
        lon: c.lon,
        visitMin: intent.visitMin ?? (meal ? MEAL_WINDOW[meal].visitMin : replaceStop?.visitMin ?? def.visitMin),
        attractionId: null,
        hours: c.hours,
        fixedStartMin: preferredStartMin ?? replaceStop?.fixedStartMin ?? null,
        ...(meal ? { mealFor: meal } : {}),
        ...(replaceStop?.mealFor ? { mealFor: replaceStop.mealFor } : {}),
      };
      // Try it at every point in the day's order and keep the cheapest, or
      // straight after the stop the reader named ("after the Met").
      const rest = ordered.filter((s) => s.key !== replaceStop?.key);
      const open = rest.length - closedStops.filter((s) => s.key !== replaceStop?.key).length;
      const named = intent.after ? rest.findIndex((s) => s.key === intent.after) : -1;
      const replacementIndex = replaceStop ? ordered.findIndex((s) => s.key === replaceStop.key) : -1;
      const slots = named >= 0 && named < open ? [named + 1]
        : replacementIndex >= 0 ? [Math.min(replacementIndex, open)]
        : Array.from({ length: open + 1 }, (_, i) => i);
      let plan: DayPlan | null = null;
      let nextStops: StopInput[] = [];
      for (const i of slots) {
        const stops = [...rest.slice(0, i), stop, ...rest.slice(i)];
        const tried = await buildPlan({ ...request, stops, keepOrder: true }, legSource);
        if (!plan || tried.summary.cost < plan.summary.cost) {
          plan = tried;
          nextStops = stops;
        }
      }
      plan = plan!;
      const at = plan.stops.findIndex((s) => s.key === stop.key);
      const planned = at >= 0 ? plan.stops[at] : undefined;
      const prev = at > 0 ? [...plan.stops.slice(0, at)].reverse().find((s) => !isMealBreak(s)) : undefined;
      const next = at >= 0 ? plan.stops.slice(at + 1).find((s) => !isMealBreak(s)) : undefined;
      const closed = plan.skipped.some((s) => s.key === stop.key);

      const conflicts: string[] = [];
      if (planned?.issue === "late" && stop.fixedStartMin != null) conflicts.push(`Earliest arrival is ${clock(planned.arriveMin)}, after your preferred ${clock(stop.fixedStartMin)}`);
      if (planned?.issue === "closes-early") conflicts.push(`${c.name} closes before this visit would finish`);
      if (planned?.issue === "closed") conflicts.push(`${c.name} would be closed when you arrive`);
      if (nextStops.length > 10) conflicts.push("Your trip is full. Replace or remove a stop before adding this place.");
      for (const s of plan.stops) {
        if (s.key === stop.key || !s.issue || baseIssue.get(s.key)) continue;
        if (s.issue === "late" && s.fixedStartMin != null) conflicts.push(`${s.name} would start late (booked ${clock(s.fixedStartMin)})`);
        else if (s.issue === "closes-early") conflicts.push(`${s.name} would run past closing`);
        else if (s.issue === "closed") conflicts.push(`${s.name} would be closed when you arrive`);
      }
      const overDelta = plan.summary.overMin - base.summary.overMin;
      if (overDelta >= 5) conflicts.push(`The day would run ${duration(plan.summary.overMin)} past ${clock(request.endMin)}`);
      const keeps = plan.stops.filter((s) => s.fixedStartMin != null && !s.issue && s.key !== stop.key).map((s) => `${s.name} at ${clock(s.fixedStartMin!)}`);

      const window = c.hours ? windowOn(c.hours, plan.dow) : null;
      const matched = matchCount(c, intent);
      const reasons: string[] = [];
      if (intent.cuisine && matched) reasons.push(c.cuisine ? c.cuisine.charAt(0).toUpperCase() + c.cuisine.slice(1) : `Matches “${intent.cuisine}”`);
      const rated = ratingText(c);
      if (rated) reasons.push(rated);
      if (c.price) reasons.push("$".repeat(c.price));
      if (intent.quiet && planned?.crowd && (planned.crowd.band === "quiet" || planned.crowd.band === "moderate")) reasons.push("Quieter streets then");
      if (c.meters < 250) reasons.push("Right on your route");

      const result: Result = {
        ...c,
        stop,
        nextStops,
        replaceKey: replaceStop?.key ?? null,
        replaceName: replaceStop?.name ?? null,
        action: replaceStop ? "replace" : meal ? "meal" : "add",
        startMin: planned && !closed ? planned.startMin : null,
        endMin: planned && !closed ? planned.endMin : null,
        after: prev?.name ?? (planned && plan.request.origin ? plan.request.origin.label : null),
        travelDelta: plan.summary.travelMin - base.summary.travelMin,
        overDelta,
        closed,
        crowdBand: planned?.crowd?.band ?? null,
        conflicts,
        keeps,
        openUntil: window && window !== "always" ? window[1] : null,
        reasons,
        detour: [prev, planned, next].filter((s): s is NonNullable<typeof s> => Boolean(s)).map((s) => [s.lon, s.lat]),
        score: 0,
      };
      result.score = scoreOf(result, intent, matched, prev?.key ?? null);
      return result;
    }),
  );
  // One card per name: chains ("Starbucks") otherwise fill the carousel.
  const seen = new Set<string>();
  return results
    .sort((a, b) => a.score - b.score)
    .filter((r) => {
      const name = r.name.toLowerCase();
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .slice(0, SHOW);
}
