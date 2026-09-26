import { haversine } from "@/lib/osm/geo";
import type { LatLon } from "@/lib/osm/types";
import { ATTRACTIONS, ATTRACTION_BY_ID, windowOn } from "./attractions";
import { CROWD_SOURCE, crowdBand, crowdProfile, levelDuring, type CrowdProfile } from "./crowd";
import { CROWD_WEIGHTS, optimize, simulate, type OptimizeInput, type Simulation } from "./optimize";
import { isMealBreak, MEAL_WINDOW, mealBreakKey, mealFits, PACE } from "./profile";
import { clock, duration, weekdayOf, WEEKDAYS } from "./time";
import { legMatrix } from "./travel";
import type { DayPlan, Leg, MealKind, PlanRequest, PlanSummary, PlannedStop, StopInput } from "./types";

function summarize(sim: Simulation, visitMin: number[]): PlanSummary {
  const known = sim.visits.filter((v) => v.crowd !== null);
  const weight = known.reduce((s, v) => s + visitMin[v.index], 0);
  return {
    travelMin: sim.travelMin,
    waitMin: sim.waitMin,
    finishMin: sim.finishMin,
    overMin: sim.overMin,
    crowdLevel: weight ? known.reduce((s, v) => s + (v.crowd ?? 0) * visitMin[v.index], 0) / weight : null,
    issues: sim.issues,
    cost: sim.cost,
  };
}

/** The quietest start hour for a visit that fits inside the day and the opening hours. */
function quietestStart(profile: CrowdProfile, visit: number, window: PlannedStop["window"], dayStart: number, dayEnd: number) {
  if (window === null) return null;
  const open = window === "always" ? dayStart : Math.max(dayStart, window[0]);
  const close = window === "always" ? dayEnd : Math.min(dayEnd, window[1]);
  let best: { startMin: number; level: number } | null = null;
  for (let s = Math.ceil(open / 60) * 60; s + visit <= close; s += 60) {
    const level = levelDuring(profile.levels, s, s + visit);
    if (!best || level < best.level) best = { startMin: s, level };
  }
  return best;
}

function insightsFor(plan: Omit<DayPlan, "insights">): string[] {
  const out: string[] = [];
  const { summary, baseline, stops, request } = plan;
  const weekday = WEEKDAYS[plan.dow];

  for (const s of plan.skipped) out.push(`${s.name} is usually closed on ${weekday}s, so it's left out. Pick another day to include it.`);
  for (const s of stops) {
    if (s.issue === "late" && s.fixedStartMin != null) {
      out.push(`You'd reach ${s.name} at ${clock(s.arriveMin)}, after its ${clock(s.fixedStartMin)} start. Drop or shorten a stop before it.`);
    }
  }
  for (const s of stops) {
    if (!s.meal) continue;
    const near = s.nearbyFood ? ` ${s.nearbyFood.name} is ${Math.round(s.nearbyFood.meters / 80)} min away.` : "";
    const late = s.startMin > MEAL_WINDOW[s.meal].start[1];
    if (late) out.push(`${!isMealBreak(s) ? `${s.name} (your ${s.meal})` : MEAL_WINDOW[s.meal].label} can't fit until ${clock(s.startMin)}: the day is full. Drop a stop to eat earlier.`);
    else {
      out.push(
        !isMealBreak(s)
          ? `${s.name} doubles as ${s.meal} at ${clock(s.startMin)}.`
          : `${s.name} at ${clock(s.startMin)}, wherever you are then.${near}`,
      );
    }
  }
  const { walkMax } = request.profile;
  if (request.mode === "transit" && walkMax !== null && stops.some((s) => s.leg?.mode === "subway")) {
    out.push(`Walks over ${walkMax} min go by subway instead, to match how you like to travel.`);
  }
  for (const s of stops) {
    if (s.issue === "closes-early" && s.window && s.window !== "always") {
      out.push(`${s.name} closes at ${clock(s.window[1])}, before a ${duration(s.visitMin)} visit would finish. Shorten it or drop a stop.`);
    }
  }

  if (baseline && stops.length > 2) {
    const saved = baseline.travelMin - summary.travelMin;
    if (saved >= 5) out.push(`This order saves ${duration(saved)} of travel versus the order you added the stops.`);
    if (baseline.crowdLevel !== null && summary.crowdLevel !== null && baseline.crowdLevel - summary.crowdLevel >= 0.08) {
      const pct = Math.round((1 - summary.crowdLevel / baseline.crowdLevel) * 100);
      out.push(`You'll visit at quieter times overall: about ${pct}% less busy than going in the order you added them.`);
    }
    if (baseline.issues > summary.issues) out.push(`Reordering fixes ${baseline.issues - summary.issues} opening-hours conflict${baseline.issues - summary.issues > 1 ? "s" : ""}.`);
  }

  // Name the timing wins: a stop visited well below its busiest time of the day.
  const timed = stops
    .filter((s) => s.crowd && !s.issue)
    .map((s) => {
      const open = s.window === "always" ? [0, 1440] : (s.window as [number, number]);
      let peakHour = -1;
      let peak = 0;
      s.crowd!.levels.forEach((l, hr) => {
        if (hr * 60 >= open[0] && hr * 60 < open[1] && hr * 60 >= request.startMin && hr * 60 < request.endMin && l > peak) {
          peak = l;
          peakHour = hr;
        }
      });
      return { s, peak, peakHour, gain: peak - s.crowd!.level };
    })
    .filter((x) => x.peakHour >= 0 && x.gain >= 0.2)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 2);
  for (const { s, peak, peakHour } of timed) {
    const pct = Math.round((s.crowd!.level / peak) * 100);
    out.push(`${s.name} at ${clock(s.startMin)}: the area is about ${pct}% as busy as at ${clock(peakHour * 60)}, its busiest hour that day.`);
  }

  // And the reverse: a stop stuck at a busy time that has a clearly quieter slot.
  for (const s of stops) {
    // A meal stays at mealtime, however quiet the street is at 9am.
    if (!s.crowd || s.issue || s.meal || s.crowd.band === "quiet" || s.crowd.band === "moderate") continue;
    const alt = quietestStart({ levels: s.crowd.levels, riders: [], station: "", stationMeters: 0 }, s.visitMin, s.window, request.startMin, request.endMin);
    if (alt && s.crowd.level - alt.level >= 0.25) {
      out.push(`${s.name} is at its busy time in this plan. It's much quieter around ${clock(alt.startMin)} if you can move things around.`);
      break;
    }
  }

  if (summary.overMin > 0) out.push(`The day runs ${duration(summary.overMin)} past ${clock(request.endMin)}. Drop a stop or shorten a visit.`);
  const subway = stops.filter((s) => s.leg?.mode === "subway").length + (plan.returnLeg?.mode === "subway" ? 1 : 0);
  if (subway) out.push(`Subway times are estimates from station distances (no live schedules). Leave a few minutes of slack.`);
  return out;
}

/**
 * The places in their listed order, with each floating meal break slotted in
 * wherever it costs least. Used when the reader has settled the order (a place
 * added to a planned day goes where it was shown to fit).
 */
function keepingOrder(input: OptimizeInput, placeCount: number): { best: Simulation; exhaustive: boolean } {
  let order = Array.from({ length: placeCount }, (_, i) => i);
  for (let b = placeCount; b < input.visitMin.length; b++) {
    let best: number[] | null = null;
    let bestCost = Infinity;
    for (let at = 0; at <= order.length; at++) {
      const tryOrder = [...order.slice(0, at), b, ...order.slice(at)];
      const cost = simulate(input, tryOrder).cost;
      if (cost < bestCost) {
        bestCost = cost;
        best = tryOrder;
      }
    }
    order = best!;
  }
  return { best: simulate(input, order), exhaustive: true };
}

/** Catalog food spots near a point, for a floating meal. */
function nearestFood(point: { lat: number; lon: number }, exclude: Set<string>) {
  let best: { id: string; name: string; meters: number } | null = null;
  for (const a of ATTRACTIONS) {
    if (a.kind !== "food" || exclude.has(a.id)) continue;
    const meters = haversine(point, a);
    if (meters < 1200 && (!best || meters < best.meters)) best = { id: a.id, name: a.name, meters: Math.round(meters) };
  }
  return best;
}

/** Travel between every pair of points; by default routed for the request's mode. */
export type LegSource = (points: LatLon[]) => Promise<{ legs: Leg[][]; routed: boolean }>;

export async function buildPlan(request: PlanRequest, legSource?: LegSource): Promise<DayPlan> {
  const dow = weekdayOf(request.date);
  const { profile } = request;
  // A place that is closed all day cannot be fitted by reordering; set it aside
  // so the rest of the day gets its time back.
  const hoursOf = (s: StopInput) => windowOn(s.attractionId ? ATTRACTION_BY_ID.get(s.attractionId)?.hours : (s.hours ?? null), dow);
  const skipped = request.stops
    .filter((s) => hoursOf(s) === null)
    .map((s) => ({ key: s.key, name: s.name, reason: `Usually closed on ${WEEKDAYS[dow]}s` }));
  const places = request.stops.filter((s) => hoursOf(s) !== null);

  // Meals: a food stop in the day serves as the meal; otherwise add a break that
  // happens wherever the day is at the time.
  const mealOf = new Map<string, MealKind>();
  const breaks: StopInput[] = [];
  for (const kind of ["lunch", "dinner"] as MealKind[]) {
    if (!request.meals[kind] || !mealFits(kind, request.startMin, request.endMin)) continue;
    // A spot picked for this meal wins; then any catalog food stop.
    const food =
      places.find((s) => s.mealFor === kind && !mealOf.has(s.key)) ??
      places.find((s) => !s.mealFor && s.attractionId && ATTRACTION_BY_ID.get(s.attractionId)?.kind === "food" && !mealOf.has(s.key));
    if (food) mealOf.set(food.key, kind);
    else {
      const key = mealBreakKey(kind);
      mealOf.set(key, kind);
      // Placeholder coordinates: a floating stop is never travelled to; it gets a real spot after planning.
      breaks.push({ key, name: MEAL_WINDOW[kind].label, lat: places[0]?.lat ?? 40.75, lon: places[0]?.lon ?? -73.98, visitMin: MEAL_WINDOW[kind].visitMin, attractionId: null });
    }
  }
  const stops = [...places, ...breaks];
  const floating = stops.map((s) => breaks.includes(s));
  const points = request.origin ? [request.origin, ...stops] : [...stops];
  const offset = request.origin ? 1 : 0;

  const route = legSource ?? ((p: LatLon[]) => legMatrix(request.mode, p, profile.walkMax));
  // Closed stops are routed too (and ignored): the same places then share one
  // cached matrix whichever day they're planned for.
  const closed = request.stops.filter((s) => !places.includes(s));
  const { legs, routed } = places.length ? await route([...points, ...closed]) : { legs: [], routed: true };
  const leg = (i: number, j: number): Leg => legs[i + offset][j + offset];

  const profiles = stops.map((s, i) => (floating[i] ? null : crowdProfile(s, dow)));
  const windows = stops.map((s, i) => (floating[i] ? ("always" as const) : hoursOf(s)));

  const input: OptimizeInput = {
    visitMin: stops.map((s) => s.visitMin),
    windows,
    levels: profiles.map((p) => p?.levels ?? null),
    travel: stops.map((_, i) => stops.map((_, j) => (i === j ? 0 : leg(i, j).minutes))),
    fromOrigin: request.origin ? stops.map((_, j) => legs[0][j + 1].minutes) : null,
    toOrigin: request.origin && request.returnToOrigin ? stops.map((_, i) => legs[i + 1][0].minutes) : null,
    startMin: request.startMin,
    endMin: request.endMin,
    crowdWeight: CROWD_WEIGHTS[request.crowd],
    fixedStart: stops.map((s) => s.fixedStartMin ?? null),
    softWindow: stops.map((s) => (mealOf.has(s.key) ? MEAL_WINDOW[mealOf.get(s.key)!].start : null)),
    floating,
    bufferMin: PACE[profile.pace].bufferMin,
  };

  const { best, exhaustive } = request.keepOrder ? keepingOrder(input, places.length) : optimize(input);
  const baselineSim = simulate(input, stops.map((_, i) => i));

  const inPlan = new Set(stops.flatMap((s) => (s.attractionId ? [s.attractionId] : [])));
  let lastPlace: number | null = null;
  const planned: PlannedStop[] = best.visits.map((v, k) => {
    const stop = stops[v.index];
    const crowd = profiles[v.index];
    let into: Leg | null = null;
    let at = { lat: stop.lat, lon: stop.lon };
    if (floating[v.index]) {
      // Eat where the day is: after the last place, or before the next, or at the start.
      const next = best.visits.slice(k + 1).find((x) => !floating[x.index]);
      const anchor = lastPlace !== null ? stops[lastPlace] : next ? stops[next.index] : request.origin;
      if (anchor) at = { lat: anchor.lat, lon: anchor.lon };
    } else {
      into = lastPlace !== null ? leg(lastPlace, v.index) : request.origin ? legs[0][v.index + 1] : null;
      lastPlace = v.index;
    }
    return {
      ...stop,
      ...at,
      arriveMin: v.arriveMin,
      startMin: v.startMin,
      endMin: v.endMin,
      waitMin: v.waitMin,
      window: windows[v.index],
      issue: v.issue,
      crowd:
        crowd && v.crowd !== null
          ? { level: v.crowd, band: crowdBand(v.crowd), levels: crowd.levels, station: crowd.station, stationMeters: crowd.stationMeters }
          : null,
      leg: into,
      meal: mealOf.get(stop.key) ?? null,
      nearbyFood: floating[v.index] ? nearestFood(at, inPlan) : null,
    };
  });

  const draft: Omit<DayPlan, "insights"> = {
    request,
    dow,
    stops: planned,
    returnLeg: request.origin && request.returnToOrigin && lastPlace !== null ? legs[lastPlace + 1][0] : null,
    summary: summarize(best, input.visitMin),
    baseline: places.length > 1 ? summarize(baselineSim, input.visitMin) : null,
    skipped,
    routing: { ok: routed, source: "OSRM on OpenStreetMap" },
    crowdSource: CROWD_SOURCE,
    exhaustive,
  };
  return { ...draft, insights: insightsFor(draft) };
}
