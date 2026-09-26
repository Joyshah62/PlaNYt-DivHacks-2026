import { pointKey } from "@/lib/osm/geo";
import type { LatLon } from "@/lib/osm/types";
import { buildPlan, type LegSource } from "./build";
import { fillSlot } from "./choices";
import { weekdayOf } from "./time";
import { legMatrix } from "./travel";
import type { ChoiceOutcome, PlanRequest, StopInput } from "./types";

/**
 * Travel between any of these points, routed once. Every plan built from it is
 * timed the same way (all routed, or all estimated) and costs one router call.
 */
export function sharedLegs(request: PlanRequest, extra: LatLon[] = []): LegSource {
  const all: LatLon[] = [...(request.origin ? [request.origin] : []), ...request.stops, ...extra];
  const index = new Map<string, number>();
  const points: LatLon[] = [];
  for (const p of all) {
    if (index.has(pointKey(p))) continue;
    index.set(pointKey(p), points.length);
    points.push(p);
  }
  const shared = legMatrix(request.mode, points, request.profile.walkMax);
  return async (asked) => {
    const { legs, routed } = await shared;
    const at = asked.map((p) => index.get(pointKey(p))!);
    return { legs: at.map((i) => at.map((j) => legs[i][j])), routed };
  };
}

/**
 * Plans the whole day once per option, so each choice is judged by what it does
 * to the day - travel, timing, crowds, opening hours - not by the place alone.
 * Travel is routed once, over every point any option could use.
 */
export async function compareOptions(request: PlanRequest, slot: string | null, options: (StopInput | null)[]): Promise<ChoiceOutcome[]> {
  const legSource = sharedLegs(request, options.filter((o) => o !== null));

  return Promise.all(
    options.map(async (option): Promise<ChoiceOutcome> => {
      const plan = await buildPlan({ ...request, stops: fillSlot(request.stops, slot, option) }, legSource);
      const stop = option ? plan.stops.find((s) => s.key === option.key) : undefined;
      return {
        key: option?.key ?? null,
        startMin: stop?.startMin ?? null,
        travelMin: plan.summary.travelMin,
        finishMin: plan.summary.finishMin,
        overMin: plan.summary.overMin,
        crowdBand: stop?.crowd?.band ?? null,
        issue: stop?.issue ?? null,
        closed: option ? plan.skipped.some((s) => s.key === option.key) : false,
      };
    }),
  );
}

export interface DayOutcome {
  date: string;
  dow: number;
  travelMin: number;
  finishMin: number;
  overMin: number;
  crowdLevel: number | null;
  issues: number;
  /** Stops closed that weekday. */
  closed: string[];
}

/**
 * The same day planned on each of the next `count` days from `from`, for
 * choosing when to go. Travel doesn't depend on the date and crowds and hours
 * only on the weekday, so there are at most seven distinct plans.
 */
export async function compareDays(request: PlanRequest, from: string, count: number): Promise<DayOutcome[]> {
  const legSource = sharedLegs(request);
  const dates = Array.from({ length: count }, (_, i) => {
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const byWeekday = new Map<number, Promise<Omit<DayOutcome, "date">>>();
  for (const date of dates) {
    const dow = weekdayOf(date);
    if (byWeekday.has(dow)) continue;
    byWeekday.set(
      dow,
      buildPlan({ ...request, date }, legSource).then((plan) => ({
        dow,
        travelMin: plan.summary.travelMin,
        finishMin: plan.summary.finishMin,
        overMin: plan.summary.overMin,
        crowdLevel: plan.summary.crowdLevel,
        issues: plan.summary.issues,
        closed: plan.skipped.map((s) => s.name),
      })),
    );
  }
  return Promise.all(dates.map(async (date) => ({ date, ...(await byWeekday.get(weekdayOf(date))!) })));
}
