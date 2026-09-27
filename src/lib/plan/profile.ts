import { ATTRACTIONS, windowOn, type Attraction, type AttractionKind } from "./attractions";
import type { Group, Interest, MealKind, Pace, Profile } from "./types";

export const DEFAULT_PROFILE: Profile = { pace: "balanced", group: "solo", walkMax: null, interests: [] };

export const PACE: Record<Pace, { label: string; hint: string; visitFactor: number; bufferMin: number }> = {
  relaxed: { label: "Relaxed", hint: "Longer visits, a breather between stops", visitFactor: 1.25, bufferMin: 15 },
  balanced: { label: "Balanced", hint: "Typical visit lengths", visitFactor: 1, bufferMin: 5 },
  packed: { label: "Packed", hint: "Shorter visits, see more", visitFactor: 0.8, bufferMin: 0 },
};

export const GROUP: Record<Group, { label: string; walkMax: number | null }> = {
  solo: { label: "Solo", walkMax: null },
  couple: { label: "Couple", walkMax: null },
  family: { label: "With kids", walkMax: 15 },
  seniors: { label: "Older travelers", walkMax: 10 },
};

/** How many are going: what they said, else what the group means (one, two); null when it's a family or group of unknown size. */
export function partySize(p: Pick<Profile, "group" | "people">): number | null {
  return p.people ?? (p.group === "solo" ? 1 : p.group === "couple" ? 2 : null);
}

/** A group's party size, when the group alone says it; set on switching groups so an old count doesn't linger. */
export const groupPeople = (group: Group): number | undefined => (group === "solo" ? 1 : group === "couple" ? 2 : undefined);

export const WALK_LIMITS: { value: number | null; label: string }[] = [
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: null, label: "No limit" },
];

export const INTERESTS: Record<Interest, { label: string; kinds: AttractionKind[] }> = {
  art: { label: "Art & museums", kinds: ["museum"] },
  views: { label: "Skyline views", kinds: ["view"] },
  history: { label: "Landmarks", kinds: ["landmark"] },
  outdoors: { label: "Parks", kinds: ["park"] },
  food: { label: "Food", kinds: ["food"] },
  neighborhoods: { label: "Neighborhoods", kinds: ["neighborhood"] },
};

/** Places that work well with children: space to move, things to touch, short attention spans welcome. */
const KID_FRIENDLY = new Set([
  "amnh", "intrepid", "central-park", "statue-of-liberty", "staten-island-ferry", "brooklyn-bridge-park",
  "little-island", "coney-island", "prospect-park", "top-of-the-rock", "high-line", "roosevelt-tram",
  "chelsea-market", "botanic-garden", "domino-park",
]);

/** A catalog visit length adjusted for pace, in 15-minute steps. */
export function visitFor(a: Attraction, pace: Pace): number {
  return Math.max(15, Math.round((a.visitMin * PACE[pace].visitFactor) / 15) * 15);
}

/**
 * Catalog spots that suit this traveler and are open that day, best first:
 * interest matches, then kid-friendly places for families.
 */
export function suggestFor(profile: Profile, dow: number, exclude: Set<string>, limit = 6): Attraction[] {
  const kinds = new Set(profile.interests.flatMap((i) => INTERESTS[i].kinds));
  if (!kinds.size && profile.group !== "family") return [];
  return ATTRACTIONS.filter((a) => !exclude.has(a.id) && windowOn(a.hours, dow) !== null)
    .map((a) => ({ a, score: (kinds.has(a.kind) ? 2 : 0) + (profile.group === "family" && KID_FRIENDLY.has(a.id) ? 1.5 : 0) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((x) => x.a);
}

/** When each meal may start: never earlier, and mildly penalised later. */
export const MEAL_WINDOW: Record<MealKind, { start: [number, number]; visitMin: number; label: string }> = {
  lunch: { start: [11 * 60 + 30, 13 * 60 + 30], visitMin: 60, label: "Lunch" },
  dinner: { start: [18 * 60, 20 * 60 + 30], visitMin: 75, label: "Dinner" },
};

/** A meal belongs in the day only if the day is running at that time. */
export function mealFits(kind: MealKind, dayStart: number, dayEnd: number): boolean {
  const [earliest, latest] = MEAL_WINDOW[kind].start;
  return dayStart <= latest && dayEnd >= earliest + MEAL_WINDOW[kind].visitMin;
}

/** The key of a meal break that has no place of its own. */
export const mealBreakKey = (kind: MealKind) => `meal-${kind}`;

/** Meal breaks have no place of their own: they are not pins or numbered stops. */
export const isMealBreak = (s: { key: string; meal?: MealKind | null }) => Boolean(s.meal) && s.key === mealBreakKey(s.meal!);
