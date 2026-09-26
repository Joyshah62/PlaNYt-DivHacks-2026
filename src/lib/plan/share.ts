import { ATTRACTION_BY_ID, type OpenWindow } from "./attractions";
import { DEFAULT_PROFILE } from "./profile";
import type { CrowdPref, Group, Interest, MealKind, Pace, PlanRequest, Profile, StopInput, TravelMode } from "./types";

/**
 * A plan's inputs as a short, URL-safe string, for share links and saved plans.
 * Only the request is stored, never the result: opening it re-plans with fresh
 * routes, so a link from last week still gives a sensible day. Catalog stops are
 * just their id (and visit length when changed); searched places carry a name
 * and a point.
 */

/**
 * Catalog stops are 1-4 items long; searched places 5-7 (the name, a string, tells them apart).
 * Then a fixed start (-1 = none) and the meal the stop was picked for, when set.
 */
type CompactStop =
  | [id: string, visitMin?: number, fixedStartMin?: number, meal?: MealKind]
  | [key: string, name: string, lat: number, lon: number, visitMin: number, fixedStartMin?: number, meal?: MealKind | "", hours?: (OpenWindow | 0)[]];

interface Compact {
  v: 1;
  s: CompactStop[];
  d: string;
  t: [number, number];
  m: TravelMode;
  c: CrowdPref;
  o?: [label: string, lat: number, lon: number, back: 0 | 1];
  /** Profile: pace, group, walk limit (-1 = none), interests. */
  p?: [Pace, Group, number, Interest[]];
  /** Meals: lunch, dinner. */
  e?: [0 | 1, 0 | 1];
  /** Keep the stops' order as listed (set once the reader has arranged the day). */
  k?: 1;
}

const MODES: TravelMode[] = ["transit", "walk", "bike", "car"];
const CROWDS: CrowdPref[] = ["avoid", "balanced", "ignore"];

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): string {
  const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

export function encodePlan(r: PlanRequest): string {
  const compact: Compact = {
    v: 1,
    s: r.stops.map((s): CompactStop => {
      const known = s.attractionId ? ATTRACTION_BY_ID.get(s.attractionId) : undefined;
      const fixed = s.fixedStartMin ?? null;
      const meal = s.mealFor ?? null;
      if (known) {
        if (meal) return [known.id, s.visitMin, fixed ?? -1, meal];
        if (fixed !== null) return [known.id, s.visitMin, fixed];
        return s.visitMin === known.visitMin ? [known.id] : [known.id, s.visitMin];
      }
      const place = [s.key, s.name, round(s.lat), round(s.lon), s.visitMin] as const;
      // Hours from a place search travel with the link, so a reopened day still respects them.
      if (s.hours) return [...place, fixed ?? -1, meal ?? "", s.hours.map((w) => w ?? 0)];
      if (meal) return [...place, fixed ?? -1, meal];
      return fixed !== null ? [...place, fixed] : [...place];
    }),
    d: r.date,
    t: [r.startMin, r.endMin],
    m: r.mode,
    c: r.crowd,
  };
  if (r.origin) compact.o = [r.origin.label, round(r.origin.lat), round(r.origin.lon), r.returnToOrigin ? 1 : 0];
  const pr = r.profile;
  if (pr.pace !== DEFAULT_PROFILE.pace || pr.group !== DEFAULT_PROFILE.group || pr.walkMax !== null || pr.interests.length) {
    compact.p = [pr.pace, pr.group, pr.walkMax ?? -1, pr.interests];
  }
  if (r.meals.lunch || r.meals.dinner) compact.e = [r.meals.lunch ? 1 : 0, r.meals.dinner ? 1 : 0];
  if (r.keepOrder) compact.k = 1;
  return toBase64Url(JSON.stringify(compact));
}

/** Null for anything malformed: a hand-edited or truncated link just opens an empty planner. */
export function decodePlan(code: string): PlanRequest | null {
  try {
    const c = JSON.parse(fromBase64Url(code)) as Compact;
    if (c.v !== 1 || !Array.isArray(c.s) || !/^\d{4}-\d{2}-\d{2}$/.test(c.d)) return null;
    const stops: StopInput[] = [];
    const fixedOf = (v: unknown) => (typeof v === "number" && v >= 0 && v < 1440 ? v : null);
    const hoursOf = (v: unknown) =>
      Array.isArray(v) && v.length === 7
        ? { hours: v.map((w) => (Array.isArray(w) && w.length === 2 && w.every(Number.isFinite) ? ([Number(w[0]), Number(w[1])] as OpenWindow) : null)) }
        : {};
    const mealOf = (v: unknown) => (v === "lunch" || v === "dinner" ? { mealFor: v as MealKind } : {});
    for (const item of c.s.slice(0, 10)) {
      if (typeof item[1] !== "string") {
        const a = ATTRACTION_BY_ID.get(String(item[0]));
        if (a) {
          stops.push({ key: a.id, name: a.name, lat: a.lat, lon: a.lon, visitMin: Number(item[1] ?? a.visitMin), attractionId: a.id, fixedStartMin: fixedOf(item[2]), ...mealOf(item[3]) });
        }
      } else {
        const [key, name, lat, lon, visitMin, fixed, meal, hours] = item as [string, string, number, number, number, number?, unknown?, unknown?];
        if ([lat, lon, visitMin].every(Number.isFinite)) {
          stops.push({ key: String(key), name: String(name), lat, lon, visitMin, attractionId: null, fixedStartMin: fixedOf(fixed), ...mealOf(meal), ...hoursOf(hours) });
        }
      }
    }
    const [startMin, endMin] = c.t;
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return null;
    return {
      stops,
      date: c.d,
      startMin,
      endMin,
      mode: MODES.includes(c.m) ? c.m : "transit",
      crowd: CROWDS.includes(c.c) ? c.c : "avoid",
      origin: c.o ? { label: String(c.o[0]), lat: Number(c.o[1]), lon: Number(c.o[2]) } : null,
      returnToOrigin: c.o?.[3] === 1,
      profile: c.p
        ? {
            pace: (["relaxed", "balanced", "packed"] as Pace[]).includes(c.p[0]) ? c.p[0] : "balanced",
            group: (["solo", "couple", "family", "seniors"] as Group[]).includes(c.p[1]) ? c.p[1] : "solo",
            walkMax: typeof c.p[2] === "number" && c.p[2] > 0 ? c.p[2] : null,
            interests: Array.isArray(c.p[3]) ? c.p[3].filter((i): i is Interest => typeof i === "string").slice(0, 6) : [],
          }
        : DEFAULT_PROFILE,
      meals: { lunch: c.e?.[0] === 1, dinner: c.e?.[1] === 1 },
      ...(c.k === 1 ? { keepOrder: true } : {}),
    };
  } catch {
    return null;
  }
}

// --- saved plans (this browser only) -------------------------------------------

export interface SavedPlan {
  id: string;
  title: string;
  savedAt: string;
  code: string;
}

const STORAGE_KEY = "roam:saved-plans";

export function parseSaved(raw: string | null): SavedPlan[] {
  try {
    const list = JSON.parse(raw ?? "[]");
    return Array.isArray(list) ? list.filter((p) => p && typeof p.code === "string" && typeof p.id === "string") : [];
  } catch {
    return [];
  }
}

export function readSavedRaw(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

/** Other tabs hear about changes through "storage"; this tab through our own event. */
export function subscribeSaved(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("roam:saved", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("roam:saved", onChange);
  };
}

export function storeSaved(list: SavedPlan[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 30)));
    window.dispatchEvent(new Event("roam:saved"));
    return true;
  } catch {
    // Private mode or storage full: the share link still works.
    return false;
  }
}

// --- traveler profile (this browser only) -------------------------------------

const PROFILE_KEY = "roam:profile";

export function readProfileRaw(): string {
  try {
    return localStorage.getItem(PROFILE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function parseProfile(raw: string): Profile | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Profile>;
    return {
      pace: (["relaxed", "balanced", "packed"] as Pace[]).includes(p.pace as Pace) ? (p.pace as Pace) : DEFAULT_PROFILE.pace,
      group: (["solo", "couple", "family", "seniors"] as Group[]).includes(p.group as Group) ? (p.group as Group) : DEFAULT_PROFILE.group,
      walkMax: typeof p.walkMax === "number" && p.walkMax > 0 ? p.walkMax : null,
      interests: Array.isArray(p.interests) ? p.interests.filter((i): i is Interest => typeof i === "string").slice(0, 6) : [],
    };
  } catch {
    return null;
  }
}

export function subscribeProfile(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("roam:profile", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("roam:profile", onChange);
  };
}

export function storeProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* the profile still applies for this visit */
  }
  window.dispatchEvent(new Event("roam:profile"));
}
