import type { WeeklyHours } from "@/lib/plan/attractions";
import type { CrowdBand } from "@/lib/plan/crowd";
import type { MealKind, StopInput } from "@/lib/plan/types";
import type { Category } from "./categories";

/** What the reader asked for, as the search understands it. Each follow-up edits this. */
export interface Intent {
  category: Category;
  /** e.g. "korean", "pizza". */
  cuisine: string | null;
  /** Other words to match in names, e.g. "rooftop", "vegan". */
  keywords: string[];
  /** For Google's text search, e.g. "Korean restaurant". */
  searchText: string;
  price: "cheap" | "moderate" | "upscale" | null;
  indoor: boolean | null;
  quiet: boolean;
  minRating: number | null;
  /** "We have an hour". */
  visitMin: number | null;
  /** Place it after this stop, by key. */
  after: string | null;
  meal: MealKind | null;
  /** Put it in place of this stop, by key. */
  replace: string | null;
  sort: "fit" | "closer" | "rating" | "cheaper";
  /** A few words for the header, e.g. "Korean dinner, small detour". */
  summary: string;
}

export type AreaKind = "trip" | "stop" | "origin" | "here" | "neighborhood";

export interface Area {
  kind: AreaKind;
  stopKey?: string;
  neighborhood?: string;
  /** Current location, for "here". */
  lat?: number;
  lon?: number;
}

/** A place a source returned, before it's tried in the day. */
export interface Candidate {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: Category;
  /** "Korean restaurant", "Café", "Museum". */
  kind: string;
  cuisine: string | null;
  rating: number | null;
  reviews: number | null;
  /** 1 ($) to 4 ($$$$). */
  price: number | null;
  hours: WeeklyHours | null;
  address: string | null;
  website: string | null;
  source: "google" | "openstreetmap";
  /** Meters from the nearest point of the search area. */
  meters: number;
}

/** A candidate tried in the day by the planner, with everything its card says. */
export interface Result extends Candidate {
  /** The stop as it would join the plan. */
  stop: StopInput;
  /** The whole day's stops, in order, with this place added: exactly what "Add" plans. */
  nextStops: StopInput[];
  /** Stop key it replaces, if any. */
  replaceKey: string | null;
  replaceName: string | null;
  action: "add" | "replace" | "meal";
  startMin: number | null;
  endMin: number | null;
  /** The place it follows in the planned day; null when it starts the day. */
  after: string | null;
  travelDelta: number;
  overDelta: number;
  closed: boolean;
  crowdBand: CrowdBand | null;
  /** Problems the addition creates elsewhere, e.g. "Hamilton would start late (8pm)". */
  conflicts: string[];
  /** Set times that still work, e.g. "Hamilton at 8pm". */
  keeps: string[];
  /** Where it's open until, on that day, when hours are known. */
  openUntil: number | null;
  /** Why it's here, each from data: "Korean", "4.6★ from 1,240 reviews", "Quiet around then". */
  reasons: string[];
  /** The line on the map: previous stop, this place, next stop. */
  detour: [number, number][];
  score: number;
}

export interface DiscoverResponse {
  intent: Intent;
  area: Area & { label: string };
  results: Result[];
  source: "google" | "openstreetmap";
  /** True when the source has no ratings, so the UI says so rather than implying quality. */
  unrated: boolean;
  note: string | null;
}
