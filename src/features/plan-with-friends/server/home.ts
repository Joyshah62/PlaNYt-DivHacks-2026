import { subwayLeg } from "../bridge/index";
import { walkMinutes, type Point } from "../core/fairness";
import { homeOptions, type HomePlan } from "../core/gettingHome";

const roadKm = (a: Point, b: Point) => ((walkMinutes(a, b) * 80) / 1.25 / 1000) * 1.3;

/** Offline estimates for each way home; the planner's own routing isn't needed for a rough comparison. */
export function homePlanFor(from: Point, to: Point, atMin: number): HomePlan {
  const km = roadKm(from, to);
  const subway = subwayLeg(from, to)?.minutes ?? null;
  return homeOptions(
    {
      subway: subway !== null && subway < walkMinutes(from, to) ? subway : null,
      bike: (km / 15) * 60 + 3,
      taxi: (km / 18) * 60 + 4,
      walk: walkMinutes(from, to),
      miles: km / 1.609,
    },
    { from, to, atMin },
  );
}
