import { z } from "zod";
import { ASIAN_CUISINES, CUISINE_LABELS } from "@/lib/osm/categories";
import type {
  CategoryId,
  CommuteReport,
  CommuteRow,
  DestinationKind,
  NearbyReport,
  Place,
} from "@/lib/osm/types";

/**
 * What a reader can say matters to them. Each preference names the OSM data it
 * reads, so the facts shown for it - and the score that will one day weigh it -
 * come from the same place.
 */
export type PreferenceId =
  | "commute"
  | "transit"
  | "groceries"
  | "restaurants"
  | "indian"
  | "asian"
  | "italian"
  | "coffee"
  | "nightlife"
  | "quiet"
  | "fitness"
  | "parks"
  | "entertainment"
  | "pharmacy"
  | "laundry";

export interface PreferenceDef {
  id: PreferenceId;
  label: string;
  /** Plural noun for facts: "11 {noun} within a 15-min walk". */
  noun: string;
  category: CategoryId | null;
  /** Restaurant cuisine buckets this preference narrows to. */
  cuisines?: string[];
}

export const PREFERENCES: PreferenceDef[] = [
  { id: "commute", label: "Short commute", noun: "destinations", category: null },
  { id: "transit", label: "Subway nearby", noun: "stations", category: "subway" },
  { id: "groceries", label: "Groceries", noun: "grocery stores", category: "groceries" },
  { id: "restaurants", label: "Restaurants", noun: "restaurants", category: "restaurants" },
  { id: "indian", label: "Indian food", noun: "Indian restaurants", category: "restaurants", cuisines: ["indian"] },
  { id: "asian", label: "Asian food", noun: "Asian restaurants", category: "restaurants", cuisines: ASIAN_CUISINES },
  { id: "italian", label: "Italian & pizza", noun: "Italian & pizza spots", category: "restaurants", cuisines: ["italian", "pizza"] },
  { id: "coffee", label: "Coffee shops", noun: "cafés", category: "coffee" },
  { id: "nightlife", label: "Nightlife", noun: "bars", category: "nightlife" },
  { id: "quiet", label: "Quiet streets", noun: "bars", category: "nightlife" },
  { id: "fitness", label: "Gyms", noun: "gyms", category: "fitness" },
  { id: "parks", label: "Parks", noun: "parks", category: "parks" },
  { id: "entertainment", label: "Culture", noun: "museums, cinemas & theaters", category: "entertainment" },
  { id: "pharmacy", label: "Pharmacy", noun: "pharmacies", category: "pharmacy" },
  { id: "laundry", label: "Laundromat", noun: "laundromats", category: "laundry" },
];

const PREFERENCE_IDS = PREFERENCES.map((p) => p.id) as [PreferenceId, ...PreferenceId[]];

export function preferenceDef(id: PreferenceId): PreferenceDef {
  return PREFERENCES.find((p) => p.id === id)!;
}

export const MAX_DESTINATIONS = 3;

export interface CustomDestination {
  kind: Exclude<DestinationKind, "preset">;
  text: string;
}

export interface Preferences {
  prefs: PreferenceId[];
  destinations: CustomDestination[];
}

export const EMPTY_PREFERENCES: Preferences = { prefs: [], destinations: [] };

const destinationSchema = z.object({
  kind: z.enum(["work", "school", "other"]),
  text: z.string().trim().min(2).max(120),
});

/** URL form: `p=indian,fitness` and `to=work:1 Pierrepont Plaza|school:Columbia University`. */
export function encodePreferences({ prefs, destinations }: Preferences): URLSearchParams {
  const params = new URLSearchParams();
  if (prefs.length) params.set("p", prefs.join(","));
  const to = destinations
    .filter((d) => d.text.trim())
    .map((d) => `${d.kind}:${d.text.trim().replaceAll("|", " ")}`);
  if (to.length) params.set("to", to.join("|"));
  return params;
}

/** Tolerant: unknown ids and malformed destinations are dropped, never thrown. */
export function decodePreferences(params: {
  p?: string | string[] | null;
  to?: string | string[] | null;
}): Preferences {
  const first = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const prefs = [
    ...new Set(
      first(params.p)
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is PreferenceId => (PREFERENCE_IDS as string[]).includes(s)),
    ),
  ];

  const destinations = first(params.to)
    .split("|")
    .map((raw) => {
      const i = raw.indexOf(":");
      const parsed = destinationSchema.safeParse(
        i > 0 ? { kind: raw.slice(0, i), text: raw.slice(i + 1) } : { kind: "other", text: raw },
      );
      return parsed.success ? parsed.data : null;
    })
    .filter((d): d is CustomDestination => d !== null)
    .slice(0, MAX_DESTINATIONS);

  return { prefs, destinations };
}

// ---------------------------------------------------------------------------
// Lifestyle facts
// ---------------------------------------------------------------------------

export interface LifestyleHighlight {
  pref: PreferenceId;
  label: string;
  /** The big number. Null when the data behind it did not load. */
  value: number | null;
  unit: "count" | "minutes";
  /** Completes the number: "Indian restaurants within a 15-min walk". */
  caption: string;
  /** One supporting line, e.g. the nearest place. */
  detail: string | null;
  /** Places to highlight on the map for this card. */
  placeIds: string[];
  nearest: Place | null;
}

function matching(def: PreferenceDef, nearby: NearbyReport): Place[] {
  return nearby.places.filter(
    (p) =>
      p.category === def.category &&
      (!def.cuisines || (p.cuisine !== null && def.cuisines.includes(p.cuisine))),
  );
}

function walkLabel(place: Place): string {
  return `${place.estimated ? "~" : ""}${place.walkMin} min walk`;
}

function placeHighlight(def: PreferenceDef, nearby: NearbyReport): LifestyleHighlight {
  const places = matching(def, nearby);
  const within = places.filter((p) => p.walkMin <= 15);
  const nearest = [...places].sort((a, b) => a.walkMin - b.walkMin)[0] ?? null;
  return {
    pref: def.id,
    label: def.label,
    value: within.length,
    unit: "count",
    caption: `${def.noun} within a 15-min walk`,
    detail: nearest ? `Nearest: ${nearest.name} · ${walkLabel(nearest)}` : `None found within ${nearby.radiusMeters.toLocaleString()} m`,
    placeIds: within.map((p) => p.id),
    nearest,
  };
}

function quietHighlight(def: PreferenceDef, nearby: NearbyReport): LifestyleHighlight {
  const bars = matching(def, nearby);
  const veryClose = bars.filter((p) => p.walkMin <= 5);
  return {
    pref: def.id,
    label: def.label,
    value: veryClose.length,
    unit: "count",
    caption: `bars & clubs within a 5-min walk`,
    detail:
      veryClose.length === 0
        ? "No late-night venues on the immediate blocks"
        : `Closest: ${veryClose[0].name} · ${walkLabel(veryClose[0])}`,
    placeIds: veryClose.map((p) => p.id),
    nearest: veryClose[0] ?? null,
  };
}

function transitHighlight(def: PreferenceDef, nearby: NearbyReport): LifestyleHighlight {
  const stations = matching(def, nearby).sort((a, b) => a.walkMin - b.walkMin);
  const nearest = stations[0] ?? null;
  const buses = nearby.places.filter((p) => p.category === "bus" && p.walkMin <= 5).length;
  return {
    pref: def.id,
    label: def.label,
    value: nearest?.walkMin ?? null,
    unit: "minutes",
    caption: nearest ? `walk to ${nearest.name}` : "No station within walking range",
    detail: `${buses} bus ${buses === 1 ? "stop" : "stops"} within a 5-min walk`,
    placeIds: stations.slice(0, 3).map((p) => p.id),
    nearest,
  };
}

function commuteHighlight(def: PreferenceDef, commute: CommuteReport | null): LifestyleHighlight {
  const custom = commute?.rows.filter((r) => r.kind !== "preset") ?? [];
  const rows = custom.length ? custom : (commute?.rows ?? []);
  const primary: CommuteRow | undefined = rows[0];
  return {
    pref: def.id,
    label: def.label,
    value: primary?.driveMin ?? null,
    unit: "minutes",
    caption: primary ? `drive to ${primary.label}` : "Add a destination to see your commute",
    detail:
      primary && primary.walkMin !== null && primary.walkMin <= 45
        ? `or ${primary.walkMin} min on foot`
        : custom.length > 1
          ? `+${custom.length - 1} more in Getting around`
          : null,
    placeIds: [],
    nearest: null,
  };
}

/**
 * One deterministic fact per chosen preference. No judgement words - the numbers
 * are the finding. The future match score reads these same inputs.
 */
export function lifestyleHighlights(
  prefs: PreferenceId[],
  nearby: NearbyReport | null,
  commute: CommuteReport | null,
): LifestyleHighlight[] {
  return prefs.map((id) => {
    const def = preferenceDef(id);
    if (id === "commute") return commuteHighlight(def, commute);
    if (!nearby || !nearby.placesStatus.ok) {
      return {
        pref: id,
        label: def.label,
        value: null,
        unit: "count",
        caption: "Neighborhood data didn't load",
        detail: null,
        placeIds: [],
        nearest: null,
      };
    }
    if (id === "transit") return transitHighlight(def, nearby);
    if (id === "quiet") return quietHighlight(def, nearby);
    return placeHighlight(def, nearby);
  });
}

export function cuisineLabel(bucket: string): string {
  return CUISINE_LABELS[bucket] ?? bucket;
}

// ---------------------------------------------------------------------------
// Match score (deferred)
// ---------------------------------------------------------------------------

export interface MatchInputs {
  prefs: PreferenceId[];
  nearby: NearbyReport | null;
  commute: CommuteReport | null;
  /** Open class B+C violations, reported problems in the last 12 months. */
  building: { seriousOpen: number | null; problemsLast12Months: number | null } | null;
}

export interface MatchResult {
  overall: number;
  parts: { id: string; label: string; score: number; weight: number }[];
}

/**
 * Scoring is intentionally undecided. Every input the score will need is
 * gathered above; when the method is settled it lands here, deterministic and
 * explainable, and the report's match card lights up.
 */
export function computeMatch(inputs: MatchInputs): MatchResult | null {
  void inputs;
  return null;
}
