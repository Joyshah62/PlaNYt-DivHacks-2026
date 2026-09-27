import { CATEGORIES, CATEGORY, CROWD_LABEL, clock, crowdBand, crowdProfile, weekdayOf, type StopInput } from "../bridge/index";
import { inNycArea } from "../bridge/index";
import { fallbackIntent, geminiJson, geminiKey, guardrail, renownOf, resolveDestination, searchGoogle, searchLocal, TRAVEL_SCOPE, weightedRating, type DiscoverCandidate, type Intent } from "../bridge/server";
import type { Point } from "../core/fairness";
import type { SuggestionItem } from "../core/suggestions";
import type { Idea, Trip } from "../core/types";
import { searchPlaces } from "./places";

/** What someone is after, as Gemini (or the plain words) read it. */
interface Want {
  named: string | null;
  /** The named place's street address, when known; it maps far more reliably than a name. */
  address?: string | null;
  query: string;
  category: (typeof CATEGORIES)[number] | null;
  cuisine: string | null;
  keywords: string[];
  /** A neighborhood they asked about ("in the East Village"), else null. */
  near: string | null;
  why: string | null;
  /** When they want to be there, in minutes after midnight ("breakfast at 9" is 540). */
  at?: number | null;
}

const WANTS_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "One friendly sentence to the group." },
    wants: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          named: { type: ["string", "null"], description: "A specific place's name if they named one, else null." },
          address: { type: ["string", "null"], description: "For a named place, its street address with borough if you know it ('90 Bedford St, Manhattan'), else null." },
          query: { type: "string", description: "Short search words, e.g. 'dessert' or 'rooftop bar'." },
          category: { type: ["string", "null"], enum: [...CATEGORIES, null], description: "The closest kind of place, even for a mood: 'artsy' is gallery or museum, 'historical' is landmark or museum. Null only for a named place." },
          cuisine: { type: ["string", "null"] },
          keywords: { type: "array", items: { type: "string" }, maxItems: 4, description: "Words likely in a matching place's name ('pizza', 'art'); not moods or adjectives." },
          near: { type: ["string", "null"], description: "A NYC neighborhood or area they asked for, e.g. 'East Village'; null if none." },
          why: { type: ["string", "null"], description: "Under 10 words: why this fits the group." },
          at: { type: ["integer", "null"], description: "The time they asked to be there, in minutes after midnight (9am = 540, 7pm = 1140); null if they gave none." },
        },
        required: ["named", "address", "query", "category", "cuisine", "keywords", "near", "why", "at"],
      },
    },
  },
  required: ["reply", "wants"],
} as const;

async function askGemini(system: string, text: string): Promise<{ reply: string; wants: Want[] } | null> {
  if (!geminiKey()) return null;
  try {
    // The app's Gemini client (same model and key as the planner's assistant).
    const parsed = ((await geminiJson(`${TRAVEL_SCOPE}\n\n${system}`, text, { name: "trip_wants", schema: WANTS_SCHEMA as unknown as Record<string, unknown> }, { timeoutMs: 15_000 })) ?? {}) as { reply?: string; wants?: Want[] };
    return parsed.wants?.length ? { reply: parsed.reply ?? "", wants: parsed.wants.slice(0, 5) } : null;
  } catch (error) {
    console.error("[trips/suggest]", error instanceof Error ? error.message : error);
    return null;
  }
}

const norm = (t: string) => t.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Without Gemini: if the words are a place's name ("levain bakery?"), treat them as naming it. */
async function plainWant(text: string): Promise<Want> {
  const i = fallbackIntent(text, null);
  const words = norm(text);
  const [hit] = words.length >= 4 ? await searchPlaces(text, 1) : [];
  const named = hit && norm(hit.name).startsWith(words) ? hit.name : null;
  return { named, query: text, category: i.category, cuisine: i.cuisine, keywords: i.keywords, near: null, why: null };
}

/** Where to look: the meeting spot, else the middle of the group, else Midtown. Never a member's own point. */
export function centerOf(trip: Trip): Point {
  if (trip.draft?.origin) return { lat: trip.draft.origin.lat, lon: trip.draft.origin.lon };
  const starts = Object.values(trip.members).flatMap((m) => (m.start ? [m.start] : []));
  if (starts.length) return { lat: starts.reduce((s, p) => s + p.lat, 0) / starts.length, lon: starts.reduce((s, p) => s + p.lon, 0) / starts.length };
  return { lat: 40.754, lon: -73.984 };
}

/** What Gemini may know about the room: areas, not coordinates. */
export function roomContext(trip: Trip): string {
  const places = trip.candidates.map((c) => `${c.stop.name} (${c.votes.length} vote${c.votes.length === 1 ? "" : "s"})`).join("; ") || "none yet";
  const areas = Object.values(trip.members).map((m) => m.start?.area ?? "unknown").join(", ");
  const window = trip.window ? `${clock(trip.window.from)}-${clock(trip.window.to)}` : "not set";
  const day = trip.draft?.stops.map((s) => s.name).join(" → ") || "empty";
  return `Trip: ${trip.title} (${trip.settings.date}). Group of ${Object.keys(trip.members).length}; they come from: ${areas}. Free together: ${window}. Meeting at: ${trip.draft?.origin?.label ?? "not decided"}. Places voted on: ${places}. Current day: ${day}.`;
}

function crowdHint(p: Point, trip: Trip): string | null {
  const profile = crowdProfile(p, weekdayOf(trip.settings.date));
  if (!profile) return null;
  const at = trip.window ? Math.round((trip.window.from + trip.window.to) / 2) : 15 * 60;
  const hour = Math.floor((at % 1440) / 60);
  return `Usually ${CROWD_LABEL[crowdBand(profile.levels[hour] ?? 0)].toLowerCase()} around ${clock(hour * 60)}`;
}

function fromDiscover(c: DiscoverCandidate, why: string | null, trip: Trip): SuggestionItem {
  const def = CATEGORY[c.category];
  const stop: StopInput = { key: `osm-${c.id}`.slice(0, 80), name: c.name.slice(0, 120), lat: c.lat, lon: c.lon, visitMin: def.visitMin, attractionId: null, ...(c.hours ? { hours: c.hours } : {}) };
  return { key: stop.key, name: c.name, area: c.address, category: c.kind, crowdHint: crowdHint(c, trip), why, stop };
}

/** A place found by geocoding its name, for places our own lists don't have. */
function fromPoint(name: string, p: Point, want: Want, trip: Trip): SuggestionItem {
  const def = want.category ? CATEGORY[want.category] : null;
  const stop: StopInput = { key: `place-${norm(name).replace(/ /g, "-")}`.slice(0, 80), name: name.slice(0, 120), lat: p.lat, lon: p.lon, visitMin: def?.visitMin ?? 60, attractionId: null };
  return { key: stop.key, name: stop.name, area: null, category: def?.label ?? "Place", crowdHint: crowdHint(p, trip), why: want.why, stop };
}

async function geocoded(text: string): Promise<Point | null> {
  const p = await resolveDestination(text).catch(() => null);
  return p && inNycArea(p) ? { lat: p.lat, lon: p.lon } : null;
}

const within = (a: Point, b: Point, meters: number) => Math.hypot((a.lat - b.lat) * 111_320, (a.lon - b.lon) * 84_000) <= meters;

/** `strict`: one of several themed picks, so a named place that can't be found is dropped, not swapped for look-alikes. */
async function resolveWant(want: Want, trip: Trip, limit: number, strict = false): Promise<SuggestionItem[]> {
  if (want.named) {
    // Names repeat across the city (there's a Tom's Restaurant in Brooklyn too): trust our match only
    // where the place is meant to be, by its address or, failing that, its neighborhood.
    // Only a street address with a number: "Central Park, Manhattan" maps to the middle of the park.
    const byAddress = want.address && /^\s*\d/.test(want.address) ? await geocoded(want.address) : null;
    const area = byAddress ? null : want.near ? await geocoded(`${want.near}, New York`) : null;
    const [hit] = await searchPlaces(want.named, 1);
    const fits = (p: Point) => (byAddress ? within(p, byAddress, 400) : !area || within(p, area, 3000));
    if (hit && fits(hit)) return [{ key: hit.stop.key, name: hit.name, area: hit.detail.split(" · ").slice(1).join(" · ") || null, category: hit.detail.split(" · ")[0], crowdHint: crowdHint(hit, trip), why: want.why, stop: hit.stop }];
    // Not in our lists (the Chess & Checkers House): the map still knows where it is.
    const byName = byAddress ? null : await geocoded(want.named);
    const at = byAddress ?? (byName && fits(byName) ? byName : null);
    if (at) return [fromPoint(want.named, at, want, trip)];
    if (strict) return [];
  }
  const base = fallbackIntent(want.query, null);
  const intent: Intent = { ...base, category: want.category ?? base.category, cuisine: want.cuisine ?? base.cuisine, keywords: want.keywords.length ? want.keywords : base.keywords };
  // Somewhere they named beats the meeting spot; it's geocoded as an area, not a person.
  const asked = want.near ? await geocoded(`${want.near}, New York`) : null;
  const center = asked ?? centerOf(trip);
  const near = (radius: number, i: Intent) => searchLocal([{ ...center, radius }], i).then((r) => (r ?? []).sort((a, b) => a.meters - b.meters));
  // Keywords only match names, so a mood ("artsy", "historical") matches almost nothing: top up
  // with the closest places of that kind, then look further out if the area is thin.
  // Google first, for ratings and review counts (it keeps to its own quota); the bundled OpenStreetMap otherwise.
  const rated = await searchGoogle([{ ...center, radius: 1800 }], intent).catch(() => null);
  const matched = rated?.length ? rated.sort((a, b) => a.meters - b.meters) : await near(1800, intent);
  let found = matched;
  if (found.length < limit && (intent.keywords.length || intent.cuisine)) found = [...found, ...(await near(1800, { ...intent, keywords: [], cuisine: null }))];
  if (found.length < limit) found = [...found, ...(await near(4500, { ...intent, keywords: [], cuisine: null }))];
  const seen = new Set<string>();
  const pool = found.filter((c) => !seen.has(c.id) && (seen.add(c.id), true)).slice(0, 24);
  // Best first: what they asked for, then how good and well known it is (rating and review count,
  // or renown without them), then closeness. Quality is worth up to about half an hour's walk
  // (80 m a minute): a known place a little further beats an unknown one next door, never one across town.
  const renown = await renownOf(pool);
  const hits = new Set(matched.map((c) => c.id));
  const quality = (c: DiscoverCandidate) => {
    const w = weightedRating(c);
    return w === null ? (renown.get(c.id) ?? 0) * 8 : Math.max(-20, (w - 4) * 35) + Math.min(4, Math.log10((c.reviews ?? 0) + 1)) * 2;
  };
  const rank = (c: DiscoverCandidate) => (hits.has(c.id) ? 0 : 15) + c.meters / 80 - quality(c);
  const items = pool
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, limit)
    .map((c) => fromDiscover(c, want.why, trip));
  // "Chess in Central Park" with nothing named for chess: the place they asked for is the answer.
  return asked && want.near && !matched.length ? [fromPoint(want.near, asked, want, trip), ...items].slice(0, limit) : items;
}

function dedupe(items: SuggestionItem[]): SuggestionItem[] {
  const seen = new Set<string>();
  return items.filter((i) => !seen.has(i.key) && (seen.add(i.key), true));
}

const ASK_SYSTEM =
  "You help a group of friends plan a day in New York City. From their message and the trip context, say what they want as up to 5 'wants', one per kind of place, in the order asked ('breakfast at 9, then shopping, then a movie' is three, the first at 540). " +
  "Use 'named' for a specific place they named, or the one well-known place an activity plainly means (chess in Central Park is the Chess & Checkers House). " +
  "A broad theme ('something sitcom themed', 'movie spots') is not one place or one show: give 5 wants, each a different real place, spread across different shows or options, each with 'named' (the real place's name, not the show's: Tom's Restaurant, not Monk's Café), its neighborhood in 'near', and 'why' naming the show or reason. Keep 'why' under 10 words and about the group (their times, where they meet, what they voted for).";

export interface AskAnswer {
  reply: string;
  items: SuggestionItem[];
  usedAi: boolean;
  /** The best match for each thing asked, in the order asked, with any time they gave: the day, if the host asked. */
  picks: StopInput[];
  /** What was asked for but not found ("a movie"). */
  missed: string[];
}

/** Ask Roam AI, with the room as context. Falls back to the plain words when Gemini isn't available. */
export async function askRoom(trip: Trip, text: string): Promise<AskAnswer> {
  const blocked = guardrail(text);
  if (blocked) return { reply: blocked, items: [], usedAi: false, picks: [], missed: [] };
  const ai = await askGemini(ASK_SYSTEM, `${roomContext(trip)}\n\nMessage: ${text}`);
  const wants = ai?.wants ?? [await plainWant(text)];
  const groups = await Promise.all(wants.map((w) => resolveWant(w, trip, wants.length > 1 ? 3 : 6, wants.length > 1)));
  const items = dedupe(groups.flat()).slice(0, 8);
  const picked = new Set<string>();
  const picks = groups.flatMap((g, i) => {
    const first = g.find((item) => !picked.has(item.key));
    if (!first) return [];
    picked.add(first.key);
    const at = wants[i].at;
    return [{ ...first.stop, ...(typeof at === "number" && at >= 0 && at < 1440 ? { fixedStartMin: at } : {}) }];
  });
  const missed = wants.filter((_, i) => !groups[i].length).map((w) => w.named ?? w.query);
  // The model writes its reply before the search, so it can promise places that never turned up.
  const reply = !items.length ? "I couldn't find places for that nearby. Try naming a kind of place, like a museum or a café." : ai?.reply || "Here are some places that match.";
  return { reply, items, usedAi: !!ai, picks, missed };
}

const IDEA_SYSTEM =
  "A friend left a note in a group trip chat. Say what place they want as exactly one 'want'. If the note names a specific place, or an activity that plainly means one well-known place " +
  "(chess in Central Park is the Chess & Checkers House), put its real name in 'named'. Otherwise give search words like 'dessert' and the category. Put any area they mention in 'near'.";

/** "Turn into a place": one specific place to confirm, or a few to choose from near the meeting spot. */
export async function ideaSuggestions(trip: Trip, idea: Idea): Promise<{ mode: "confirm" | "choose"; label: string; items: SuggestionItem[]; usedAi: boolean }> {
  // A note that isn't about the trip (or isn't safe) gets no places, and no model call.
  if (guardrail(idea.text)) return { mode: "choose", label: "this note", items: [], usedAi: false };
  const ai = await askGemini(IDEA_SYSTEM, `${roomContext(trip)}\n\nNote: ${idea.text}`);
  const want = ai?.wants[0] ?? (await plainWant(idea.text.replace(/[?!.]+$/, "")));
  const items = await resolveWant(want, trip, 5);
  const named = !!want.named && items.length === 1;
  return { mode: named ? "confirm" : "choose", label: named ? `Add ${items[0].name}?` : want.query, items, usedAi: !!ai };
}
