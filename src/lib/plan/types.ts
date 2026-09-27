import type { OpenWindow, WeeklyHours } from "./attractions";
import type { CrowdBand } from "./crowd";
import type { FollowUp } from "./followUps";

/** What the reader picks. "transit" = walk or subway, whichever is faster per leg. */
export type TravelMode = "transit" | "walk" | "bike" | "car";
export type CrowdPref = "avoid" | "balanced" | "ignore";

export type Pace = "relaxed" | "balanced" | "packed";
export type Group = "unspecified" | "solo" | "couple" | "family" | "seniors";
export type Interest = "art" | "views" | "history" | "outdoors" | "food" | "neighborhoods";

/** Who is travelling and how they like to travel. It shapes the plan, not just the labels. */
export interface Profile {
  pace: Pace;
  group: Group;
  /** The longest walk (minutes) worth doing before taking the subway; null = no limit. Set from the group, then editable. */
  walkMax: number | null;
  interests: Interest[];
  /**
   * How many are going, when known. Only the budget uses it, so it isn't part
   * of a plan request: changing it never re-plans the day.
   */
  people?: number;
}

export interface Meals {
  lunch: boolean;
  dinner: boolean;
}

export type MealKind = keyof Meals;

/** How one leg is actually travelled. */
export type LegMode = "walk" | "subway" | "bike" | "car";

export interface PointLabel {
  label: string;
  lat: number;
  lon: number;
}

export interface StopInput {
  /** Stable within a plan: the attraction id, or a slug for a searched place. */
  key: string;
  name: string;
  lat: number;
  lon: number;
  visitMin: number;
  attractionId: string | null;
  /** Must start at this time (a booked ferry, a show), minutes after midnight. */
  fixedStartMin?: number | null;
  /** A searched place the reader picked to eat at: it serves as that meal. */
  mealFor?: MealKind | null;
  /** Opening hours for a searched place, when a source gave them; catalog places use their own. */
  hours?: WeeklyHours | null;
}

export interface PlanRequest {
  stops: StopInput[];
  /** YYYY-MM-DD, NYC local. */
  date: string;
  /** Minutes after midnight. */
  startMin: number;
  endMin: number;
  mode: TravelMode;
  crowd: CrowdPref;
  origin: PointLabel | null;
  returnToOrigin: boolean;
  profile: Profile;
  meals: Meals;
  /** Visit places in the listed order (floating meal breaks still fit in where best) instead of optimizing it. */
  keepOrder?: boolean;
}

export interface Leg {
  mode: LegMode;
  minutes: number;
  meters: number | null;
  /** Straight-line or schedule-free estimate rather than a routed path. */
  estimated: boolean;
  /** Subway legs: where to board and get off. */
  board?: PointLabel;
  alight?: PointLabel;
  /** Subway legs: the walk to the first platform and from the last one. */
  walkToMin?: number;
  walkFromMin?: number;
  /** Subway legs: one ride, or two with a transfer between them. */
  rides?: Ride[];
}

export interface Ride {
  /** Lines that run between the two stations, e.g. ["4", "5", "6"]. Empty when unknown. */
  lines: string[];
  from: PointLabel;
  to: PointLabel;
  /** "uptown", "downtown", or "toward Brooklyn". */
  direction: string;
  minutes: number;
}

export type StopIssue = "closed" | "closes-early" | "late" | null;

export interface PlannedStop extends StopInput {
  arriveMin: number;
  /** After any wait for opening. */
  startMin: number;
  endMin: number;
  waitMin: number;
  /** Today's hours: a window, "always" open, or null = closed today. */
  window: OpenWindow | "always" | null;
  issue: StopIssue;
  crowd: {
    level: number;
    band: CrowdBand;
    /** 24 hourly levels for the day, for the strip. */
    levels: number[];
    station: string;
    stationMeters: number;
  } | null;
  /** Travel into this stop; null for the first stop when there is no origin, and for meals. */
  leg: Leg | null;
  /** Set when this stop is a meal: a generic break, or a food stop serving as one. */
  meal: MealKind | null;
  /** Generic meal breaks: a catalog food spot close to where the meal falls. */
  nearbyFood: { id: string; name: string; meters: number } | null;
}

export interface PlanSummary {
  travelMin: number;
  waitMin: number;
  finishMin: number;
  /** Minutes past the end of the day. */
  overMin: number;
  /** Visit-minute-weighted average crowd level, 0..1. */
  crowdLevel: number | null;
  issues: number;
  /** The optimizer's objective for this day (travel, waits, crowds, penalties); lower is better. */
  cost: number;
}

export interface DayPlan {
  request: PlanRequest;
  dow: number;
  stops: PlannedStop[];
  returnLeg: Leg | null;
  summary: PlanSummary;
  /** The same day in the order the stops were added, for comparison. */
  baseline: PlanSummary | null;
  insights: string[];
  /** Stops left out because they are closed that day. */
  skipped: { key: string; name: string; reason: string }[];
  routing: { ok: boolean; source: string };
  crowdSource: { name: string; weeks: string[] };
  /** Whether the search tried every order (true) or stopped at a good one. */
  exhaustive: boolean;
}

/** What the assistant read from a free-text request; nulls mean "not mentioned". */
export interface AssistantResult {
  stops: StopInput[];
  /** Places it named but that could not be found on the map. */
  unresolved: string[];
  date: string | null;
  startMin: number | null;
  endMin: number | null;
  mode: TravelMode | null;
  crowd: CrowdPref | null;
  origin: PointLabel | null;
  /** Only the profile fields the request implied. */
  profile: Partial<Profile>;
  meals: Partial<Meals>;
  /** Vague wishes ("a skyline view") with the other places that would satisfy them. */
  choices: Choice[];
  reply: string;
  /** The traveler's memory id (see lib/memory), for the app to send back next time. */
  memoryId?: string;
  /** Asked before planning (when? who?); when present, nothing was planned yet. */
  questions?: FollowUp[];
}

/** One place that could fill a slot in the day, and why it's offered. */
export interface ChoiceOption extends StopInput {
  why: string;
}

/**
 * A slot in the day the reader can fill in more than one way: a vague wish the
 * assistant filled, or a meal. Options are compared by re-planning the whole day
 * with each one, so the cards show what each choice does to the day.
 */
export interface Choice {
  id: string;
  kind: "wish" | "meal";
  /** "A skyline view", "Lunch". */
  title: string;
  /** The stop in the day that fills it now; null for a meal left to happen wherever the day is. */
  currentKey: string | null;
  options: ChoiceOption[];
  meal?: MealKind;
  /** Meals: where the options were looked up around. */
  anchor?: { lat: number; lon: number; near: string | null };
}

/** The day re-planned with one option in the slot. */
export interface ChoiceOutcome {
  /** The option's key, or null for "no place" (a floating meal). */
  key: string | null;
  startMin: number | null;
  travelMin: number;
  finishMin: number;
  overMin: number;
  crowdBand: CrowdBand | null;
  issue: StopIssue;
  /** Closed all day on the plan's date, so it would be left out. */
  closed: boolean;
}
