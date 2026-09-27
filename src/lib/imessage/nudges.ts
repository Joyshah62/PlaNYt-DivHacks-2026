import { mapsDirections, mapsPoint } from "@/lib/plan/maps";
import { isMealBreak } from "@/lib/plan/profile";
import { clock } from "@/lib/plan/time";
import type { DayPlan } from "@/lib/plan/types";
import type { DayWeather } from "@/lib/plan/weatherCodes";
import { legLine, weatherLine } from "./format";

export interface Nudge {
  /** Once sent, never again: date plus what it's about. */
  key: string;
  text: string;
}

/** How early the "leave now" text goes out, and the morning one before the first stop. */
export const LEAVE_LEAD_MIN = 10;
export const MORNING_LEAD_MIN = 60;

/**
 * The texts due right now on the day of the trip. Each has a window, so a bot
 * that was down doesn't send a pile of stale "leave now"s when it comes back.
 */
export function dueNudges(plan: DayPlan, today: string, nowMin: number, sent: ReadonlySet<string>, weather: DayWeather | null = null): Nudge[] {
  const { request } = plan;
  if (request.date !== today || !plan.stops.length) return [];
  const out: Nudge[] = [];
  const add = (key: string, from: number, until: number, text: () => string) => {
    const k = `${request.date}:${key}`;
    if (!sent.has(k) && nowMin >= from && nowMin < until) out.push({ key: k, text: text() });
  };

  const first = plan.stops[0];
  const firstLeave = first.leg ? first.arriveMin - first.leg.minutes : first.arriveMin;
  add("morning", firstLeave - MORNING_LEAD_MIN, first.startMin, () =>
    [
      `☀️ Today's the day! ${plan.stops.filter((s) => !isMealBreak(s)).length} stops, ${clock(first.startMin)}–${clock(plan.summary.finishMin)}.`,
      weather ? `Weather: ${weatherLine(weather)}.` : null,
      `First up: ${first.name} at ${clock(first.startMin)}${first.leg ? ` (leave by ${clock(firstLeave)})` : ""}.`,
      "I'll text you before each leg. Reply PLAN to see the whole day.",
    ]
      .filter(Boolean)
      .join(" "),
  );

  plan.stops.forEach((s, i) => {
    const prev = plan.stops.slice(0, i).reverse().find((x) => !isMealBreak(x)) ?? null;
    if (isMealBreak(s)) {
      add(`meal:${s.key}`, s.startMin - 5, s.startMin + 20, () =>
        `🍴 ${s.name} time${prev ? ` near ${prev.name}` : ""}.${s.nearbyFood ? ` Close by: ${s.nearbyFood.name}.` : ""} Want ideas? Text "find ${s.meal} nearby".`,
      );
      return;
    }
    if (!s.leg) return;
    const leave = s.arriveMin - s.leg.minutes;
    const from = prev ?? request.origin;
    add(`leave:${s.key}`, leave - LEAVE_LEAD_MIN, s.arriveMin, () => {
      const directions = from ? ` Directions: ${mapsDirections(mapsPoint(from), mapsPoint(s), s.leg!.mode)}` : "";
      return `🚶 Leave by ${clock(leave)} for ${s.name}: ${legLine(s.leg!)}. You're there ${clock(s.startMin)}–${clock(s.endMin)}.${directions}`;
    });
  });
  return out;
}
