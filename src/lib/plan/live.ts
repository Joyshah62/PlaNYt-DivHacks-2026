import type { DayPlan, PlannedStop } from "./types";

/** Where the day stands at one moment: before it starts, at a stop, on the way to one, or over. */
export type NextStep =
  | { kind: "before"; stop: PlannedStop; leaveBy: number }
  | { kind: "at"; stop: PlannedStop; until: number; next: PlannedStop | null }
  | { kind: "moving"; to: PlannedStop; from: PlannedStop | null; arriveBy: number }
  | { kind: "done" };

/** When the traveler has to set off for a stop: its arrival minus the leg into it. */
export const departureFor = (s: PlannedStop) => s.arriveMin - (s.leg?.minutes ?? 0);

export function nextStep(plan: DayPlan, now: number): NextStep {
  const { stops } = plan;
  if (!stops.length) return { kind: "done" };
  if (now < departureFor(stops[0])) return { kind: "before", stop: stops[0], leaveBy: departureFor(stops[0]) };
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (now < s.arriveMin) return { kind: "moving", to: s, from: stops[i - 1] ?? null, arriveBy: s.arriveMin };
    if (now < s.endMin) return { kind: "at", stop: s, until: s.endMin, next: stops[i + 1] ?? null };
  }
  return { kind: "done" };
}
