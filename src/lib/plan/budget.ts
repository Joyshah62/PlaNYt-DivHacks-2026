import { ATTRACTION_BY_ID } from "./attractions";
import { isMealBreak } from "./profile";
import type { DayPlan, PlannedStop } from "./types";

/** OMNY pay-per-ride fare in 2026; subway-to-subway transfers are free. */
export const SUBWAY_FARE = 3;
/** A typical sit-down meal in Manhattan, per person, when no place is chosen. */
export const MEAL_ESTIMATE = { lunch: 25, dinner: 45 } as const;
/** A casual meal or coffee stop whose prices couldn't be found. */
export const FOOD_ESTIMATE = 20;

export type PriceKind = "ticket" | "food";

/** Only the facts about a price the budget needs; the web lookup supplies them. */
export interface KnownPrice {
  perPerson: number | null;
  free: boolean;
  bookAhead: boolean;
  note: string | null;
  url: string | null;
}

export interface BudgetLine {
  key: string;
  name: string;
  /** Null: couldn't find a price. */
  perPerson: number | null;
  /** How the number was arrived at, for the reader. */
  basis: "free" | "web" | "estimate" | "unknown";
  bookAhead: boolean;
  note: string | null;
  url: string | null;
}

export interface DayBudget {
  lines: BudgetLine[];
  transit: { rides: number; fare: number; total: number; note: string | null };
  /** Everything with a known or estimated price, per person. */
  perPerson: number;
  unknown: number;
}

/** What kind of price a stop has, or "free" when it can't cost anything (a park, a neighborhood). */
export function priceKindOf(stop: Pick<PlannedStop, "attractionId" | "name">): PriceKind | "free" {
  const a = stop.attractionId ? ATTRACTION_BY_ID.get(stop.attractionId) : undefined;
  if (a?.kind === "park" || a?.kind === "neighborhood") return "free";
  if (a?.kind === "food") return "food";
  if (a) return "ticket";
  // A place found by search: food words mean a meal; anything else might charge entry.
  return /caf[eé]|coffee|pizza|restaurant|deli|bakery|bar\b|diner|kitchen|grill|bistro|ramen|sushi|taco|burger|bagel|espresso|tea\b|trattoria|pizzeria/i.test(stop.name) ? "food" : "ticket";
}

/** The day's cost per person: each stop, meals without a place, and subway rides. */
export function assembleBudget(plan: DayPlan, prices: Map<string, KnownPrice | null>): DayBudget {
  const lines: BudgetLine[] = plan.stops.map((s) => {
    if (isMealBreak(s)) {
      const meal = s.meal === "dinner" ? "dinner" : "lunch";
      return { key: s.key, name: s.name, perPerson: MEAL_ESTIMATE[meal], basis: "estimate", bookAhead: false, note: `Typical NYC ${meal}`, url: null };
    }
    if (priceKindOf(s) === "free") return { key: s.key, name: s.name, perPerson: 0, basis: "free", bookAhead: false, note: null, url: null };
    const p = prices.get(s.key);
    // A place to eat always costs something; an estimate, said as one, beats a gap in the total.
    if ((!p || (p.perPerson === null && !p.free)) && priceKindOf(s) === "food") {
      return { key: s.key, name: s.name, perPerson: FOOD_ESTIMATE, basis: "estimate", bookAhead: p?.bookAhead ?? false, note: "Typical casual meal", url: p?.url ?? null };
    }
    if (!p || (p.perPerson === null && !p.free)) return { key: s.key, name: s.name, perPerson: null, basis: "unknown", bookAhead: p?.bookAhead ?? false, note: p?.note ?? null, url: p?.url ?? null };
    return { key: s.key, name: s.name, perPerson: p.free ? 0 : p.perPerson, basis: p.free ? "free" : "web", bookAhead: p.bookAhead, note: p.note, url: p.url };
  });
  const legs = [...plan.stops.map((s) => s.leg), plan.returnLeg].filter((l) => l?.mode === "subway");
  const mode = plan.request.mode;
  const transit = {
    rides: legs.length,
    fare: SUBWAY_FARE,
    total: legs.length * SUBWAY_FARE,
    note: mode === "car" ? "Driving, parking and tolls not included" : mode === "bike" ? "Bike rental not included" : null,
  };
  const perPerson = lines.reduce((sum, l) => sum + (l.perPerson ?? 0), 0) + transit.total;
  return {
    lines,
    transit,
    perPerson,
    unknown: lines.filter((l) => l.basis === "unknown").length,
  };
}

/** The whole party's cost: "About $156" for two at $78 each. */
export const partyTotal = (budget: Pick<DayBudget, "perPerson">, people: number) => budget.perPerson * people;

/** "$0", "$30", "~$25". */
export function money(line: Pick<BudgetLine, "perPerson" | "basis">): string {
  if (line.basis === "free" || line.perPerson === 0) return "Free";
  if (line.perPerson === null) return "Price unknown";
  return `${line.basis === "estimate" ? "~" : ""}$${line.perPerson}`;
}
