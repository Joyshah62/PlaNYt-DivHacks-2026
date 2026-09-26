import type { ChoiceOption, ChoiceOutcome, StopInput } from "./types";

/**
 * The day's stops with `slot` filled by `option`: the option takes the slot's
 * place in the list and keeps any set start time and the meal it was for. A null option just empties
 * the slot (a meal goes back to happening wherever the day is).
 */
export function fillSlot(stops: StopInput[], slot: string | null, option: StopInput | ChoiceOption | null): StopInput[] {
  const at = slot ? stops.findIndex((s) => s.key === slot) : -1;
  const rest = stops.filter((s) => s.key !== slot && s.key !== option?.key);
  if (!option) return rest;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { why, ...stop } = option as ChoiceOption;
  const slotStop = at >= 0 ? stops[at] : null;
  const filled: StopInput = {
    ...stop,
    fixedStartMin: slotStop?.fixedStartMin ?? stop.fixedStartMin ?? null,
    mealFor: slotStop?.mealFor ?? stop.mealFor ?? null,
  };
  const index = at >= 0 ? Math.min(at, rest.length) : rest.length;
  return [...rest.slice(0, index), filled, ...rest.slice(index)];
}

/** Lower is better: travel, a crowd penalty, and heavy penalties for a day that no longer works. */
export function outcomeCost(o: ChoiceOutcome): number {
  const crowd = o.crowdBand === null ? 0 : { quiet: 0, moderate: 8, busy: 18, peak: 30 }[o.crowdBand];
  return o.travelMin + crowd + o.overMin * 2 + (o.issue ? 60 : 0) + (o.closed ? 500 : 0);
}

/** The option that makes the best day, if it is clearly better than the rest. */
export function bestOutcome(outcomes: ChoiceOutcome[]): ChoiceOutcome | null {
  if (outcomes.length < 2) return null;
  const sorted = [...outcomes].sort((a, b) => outcomeCost(a) - outcomeCost(b));
  return outcomeCost(sorted[1]) - outcomeCost(sorted[0]) >= 3 ? sorted[0] : null;
}
