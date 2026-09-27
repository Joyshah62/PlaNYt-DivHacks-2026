import { haversine } from "@/lib/osm/geo";
import type { LatLon } from "@/lib/osm/types";

/** Only trade the assistant's pick for a closer option when it saves at least this much. */
export const WORTH_SWITCHING_M = 800;

export interface Wish {
  /** The option in the day now (the assistant's pick). */
  current: string;
  options: (LatLon & { key: string })[];
}

/** How far `p` is from the nearest of `anchors`: roughly the detour it adds to the day. */
function reach(p: LatLon, anchors: LatLon[]): number {
  return Math.min(...anchors.map((a) => haversine(p, a)));
}

/**
 * For each vague wish ("good pizza", "a skyline view"), the option that keeps the day tight:
 * every option is already a good one, so take the one nearest the rest of the day (the places
 * they named, where they start, the other wishes), unless the assistant's pick is about as
 * close. With nothing else in the day to be near, the wishes are pulled toward each other.
 * Returns the chosen option key for each wish, in order.
 */
export function nearestPicks(fixed: LatLon[], wishes: Wish[]): string[] {
  const chosen = wishes.map((w) => w.current);
  const at = (i: number) => wishes[i].options.find((o) => o.key === chosen[i]);
  // Two passes: a wish that moves can make another wish's closer option worth it.
  for (let pass = 0; pass < 2; pass++) {
    wishes.forEach((w, i) => {
      const others = wishes.flatMap((_, j) => (j === i ? [] : [at(j)].filter((o): o is NonNullable<typeof o> => !!o)));
      const anchors = [...fixed, ...others];
      const now = at(i);
      if (!anchors.length || !now) return;
      const best = w.options.reduce((a, b) => (reach(b, anchors) < reach(a, anchors) ? b : a));
      if (reach(now, anchors) - reach(best, anchors) >= WORTH_SWITCHING_M) chosen[i] = best.key;
    });
  }
  return chosen;
}
