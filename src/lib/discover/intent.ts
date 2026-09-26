import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { isMealBreak } from "@/lib/plan/profile";
import { clock } from "@/lib/plan/time";
import type { DayPlan } from "@/lib/plan/types";
import { CATEGORIES, type Category } from "./categories";
import type { Area, Intent } from "./types";

/**
 * Turning "Korean food for dinner without a big detour" or a follow-up like
 * "cheaper" into a structured search. Gemini only reads the words; which places
 * come back, and why, is decided from data by the search and the planner.
 */

export const IntentSchema = z.object({
  category: z.enum(CATEGORIES),
  cuisine: z.string().nullable().describe("A cuisine or dish in lowercase, e.g. \"korean\", \"pizza\", \"ramen\"; null if none."),
  keywords: z.array(z.string()).describe("Other words a matching place's name might contain, e.g. [\"rooftop\"]. Usually empty."),
  searchText: z.string().describe("A short map search for this, e.g. \"Korean restaurant\", \"quiet cafe\", \"bowling alley\"."),
  price: z.enum(["cheap", "moderate", "upscale"]).nullable(),
  indoor: z.boolean().nullable().describe("true for indoors or rain-proof, false for outdoors, null if not said."),
  quiet: z.boolean().describe("true if they want calm, quiet or uncrowded."),
  minRating: z.number().nullable().describe("Only if they ask for highly rated or best: 4.3. Otherwise null."),
  visitMin: z.number().nullable().describe("Minutes they have or want to spend, e.g. \"we have an hour\" = 60; else null."),
  after: z.string().nullable().describe("Stop key it should come after, e.g. \"after the Met\"; else null."),
  meal: z.enum(["lunch", "dinner"]).nullable().describe("\"lunch\" or \"dinner\" when it's for that meal; else null."),
  replace: z.string().nullable().describe("Stop key to replace, e.g. \"replace my lunch stop\"; else null."),
  sort: z.enum(["fit", "closer", "rating", "cheaper"]).describe("\"closer\", \"rating\" (best, highest rated) or \"cheaper\" when asked; else \"fit\"."),
  summary: z.string().describe("Under 7 words restating the search, e.g. \"Korean dinner, small detour\"."),
  area: z
    .object({
      kind: z.enum(["trip", "stop", "origin", "here", "neighborhood"]),
      stopKey: z.string().nullable(),
      neighborhood: z.string().nullable(),
    })
    .nullable()
    .describe("Only if the words name where to look: a stop (\"near our last stop\"), \"near my hotel\" (origin), \"near me\" (here) or a neighborhood (\"in Williamsburg\"). null otherwise."),
});

type Parsed = z.infer<typeof IntentSchema>;
const SCHEMA: Record<string, unknown> = z.toJSONSchema(IntentSchema);
delete SCHEMA.$schema;

const MODEL = "gemini-3.5-flash-lite";
let client: GoogleGenAI | null = null;

const SYSTEM = `You turn a traveler's request into a search for one place to add to their New York day plan. Fill every field.

- Categories: restaurant (any meal or cuisine), cafe (coffee, tea), bar, dessert (ice cream, bakery, sweets), museum, gallery, park, viewpoint (skyline, views), shopping, activity (something fun: bowling, arcade, escape room, zoo, cinema, show), landmark.
- A follow-up refines the previous search: keep every field it doesn't change. "cheaper" sets price "cheap" and sort "cheaper". "closer" sets sort "closer". "something indoors" sets indoor true and, if the category is outdoors, switches to an indoor one that fits. "better" or "highest rated" sets sort "rating".
- Use the stop keys given for after, replace and area.stopKey. "Our last stop" is the last listed stop. "My lunch stop" is the stop marked lunch.
- "after X" / "following X" sets after. "near X" / "by X" / "around X" sets area to that stop and leaves after null.
- indoor: null unless they mention indoors, outdoors, rain or weather.
- Never name specific places. Leave area null unless the words say where to look.`;

function planContext(plan: DayPlan): string {
  const lines = plan.stops
    .filter((s) => !isMealBreak(s))
    .map((s) => `${s.key}: ${s.name} at ${clock(s.startMin)}${s.meal ? ` [${s.meal}]` : ""}${s.fixedStartMin != null ? ` [booked ${clock(s.fixedStartMin)}]` : ""}`);
  const breaks = plan.stops.filter(isMealBreak).map((s) => `${s.meal} break around ${clock(s.startMin)}`);
  return `Stops in order:\n${lines.join("\n")}${breaks.length ? `\nMeal breaks: ${breaks.join(", ")}` : ""}${plan.request.origin ? `\nStarting from: ${plan.request.origin.label}` : ""}`;
}

export async function parseIntent(query: string, plan: DayPlan, previous: Intent | null): Promise<{ intent: Intent; area: Partial<Area> | null }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    try {
      client ??= new GoogleGenAI({ apiKey });
      const response = await client.models.generateContent({
        model: MODEL,
        contents: `${planContext(plan)}\n\n${previous ? `Previous search: ${JSON.stringify(previous)}\n\nFollow-up: ` : "Request: "}${query}`,
        config: { systemInstruction: SYSTEM, responseMimeType: "application/json", responseJsonSchema: SCHEMA, abortSignal: AbortSignal.timeout(20_000) },
      });
      const parsed = IntentSchema.safeParse(JSON.parse(response.text ?? "null"));
      if (parsed.success) return clean(parsed.data, plan, query, previous);
      console.error("[discover] unusable intent", parsed.error.issues[0]?.message);
    } catch (error) {
      console.error("[discover] intent failed:", error instanceof Error ? error.message : error);
    }
  }
  return fallbackWithPlan(query, previous, plan);
}

/**
 * Drop stop keys that aren't in the plan, and constraints the words didn't state:
 * "after X" pins where the place goes and an area narrows where to look, so both
 * must come from what the reader said, not from the model's guess.
 */
function clean(p: Parsed, plan: DayPlan, query: string, previous: Intent | null): { intent: Intent; area: Partial<Area> | null } {
  const keys = new Set(plan.request.stops.map((s) => s.key));
  const q = query.toLowerCase();
  const saysAfter = /\b(after|following|once we'?re done|then)\b/.test(q);
  const saysWhere = /\b(near|by|around|in|close to|next to|at|last stop|hotel|me)\b/.test(q);
  const { area: rawArea, ...rest } = p;
  const area = saysWhere ? rawArea : null;
  const after = saysAfter ? p.after : (previous?.after ?? null);
  const intent: Intent = {
    ...rest,
    after: after && keys.has(after) ? after : null,
    replace: p.replace && keys.has(p.replace) ? p.replace : null,
    visitMin: p.visitMin ? Math.max(15, Math.min(240, Math.round(p.visitMin))) : null,
    minRating: p.minRating ? Math.max(3, Math.min(4.8, p.minRating)) : null,
    cuisine: p.cuisine?.trim().toLowerCase() || null,
    keywords: p.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 3),
  };
  if (!area) return { intent, area: null };
  if (area.kind === "stop" && !(area.stopKey && keys.has(area.stopKey))) return { intent, area: null };
  if (area.kind === "neighborhood" && !area.neighborhood) return { intent, area: null };
  return { intent, area: { kind: area.kind, stopKey: area.stopKey ?? undefined, neighborhood: area.neighborhood ?? undefined } };
}

// --- without Gemini ---------------------------------------------------------------

// Word edges that also work next to accented letters ("café"), which \b doesn't.
const W = (alternatives: string) => new RegExp(`(?<![\\p{L}])(?:${alternatives})(?![\\p{L}])`, "u");
const WORDS: [RegExp, Category][] = [
  [W("coffee|cafe|café|cafes|cafés|espresso|tea"), "cafe"],
  [W("bars?|drinks?|cocktails?|beers?|wine"), "bar"],
  [W("desserts?|ice cream|gelato|bakery|bakeries|pastry|pastries|sweets?|donuts?|cookies?"), "dessert"],
  [W("museums?"), "museum"],
  [W("gallery|galleries|art"), "gallery"],
  [W("view|views|skyline|lookout|viewpoint"), "viewpoint"],
  [W("shop|shops|shopping|store|stores|boutiques?|books?|bookstore"), "shopping"],
  [W("fun|activity|activities|bowling|arcade|escape room|mini golf|skating"), "activity"],
  [W("landmarks?|monuments?|historic"), "landmark"],
  [W("food|eat|lunch|dinner|restaurants?|pizza|burgers?|sushi|ramen|korean|thai|chinese|italian|mexican|indian|bagels?|dumplings?|tacos?"), "restaurant"],
  // Last: "park" also appears in stop names ("a café after Central Park").
  [W("park|parks|garden|gardens|green space"), "park"],
];
const CUISINES = ["pizza", "korean", "thai", "chinese", "italian", "mexican", "indian", "japanese", "sushi", "ramen", "burger", "bagel", "vegan", "french", "greek", "vietnamese", "dumpling", "taco"];

/**
 * The keyword reading plus what it can tell from the plan: "after the Met" and
 * "near our last stop" by stop name, "my lunch stop" by the stop serving lunch.
 */
export function fallbackWithPlan(query: string, previous: Intent | null, plan: DayPlan): { intent: Intent; area: Partial<Area> | null } {
  const intent = fallbackIntent(query, previous);
  const q = query.toLowerCase();
  const places = plan.stops.filter((s) => !isMealBreak(s));
  const bare = (name: string) => name.toLowerCase().replace(/^the\s+/, "");
  const named = (word: string) => {
    const hit = new RegExp(`${word}\\s+(?:the\\s+)?(.+)`).exec(q)?.[1] ?? "";
    if (/^(our |my |the )?last stop/.test(hit)) return places[places.length - 1] ?? null;
    return places.find((s) => hit.startsWith(bare(s.name)) || hit.includes(bare(s.name))) ?? null;
  };
  const after = named("after");
  if (after) intent.after = after.key;
  const lunchStop = places.find((s) => s.meal === "lunch");
  const dinnerStop = places.find((s) => s.meal === "dinner");
  if (/replace (my |the )?lunch/.test(q) && lunchStop) intent.replace = lunchStop.key;
  if (/replace (my |the )?dinner/.test(q) && dinnerStop) intent.replace = dinnerStop.key;
  const near = named("near") ?? named("by");
  return { intent, area: near ? { kind: "stop", stopKey: near.key } : null };
}

/** Keyword matching, so discovery still works without an API key. */
export function fallbackIntent(query: string, previous: Intent | null): Intent {
  const q = query.toLowerCase();
  const category = WORDS.find(([re]) => re.test(q))?.[1] ?? previous?.category ?? "restaurant";
  const cuisine = CUISINES.find((c) => q.includes(c)) ?? (previous && category === previous.category ? previous.cuisine : null);
  const base: Intent = previous && category === previous.category ? { ...previous } : {
    category,
    cuisine: null,
    keywords: [],
    searchText: query.slice(0, 60),
    price: null,
    indoor: null,
    quiet: false,
    minRating: null,
    visitMin: null,
    after: null,
    meal: null,
    replace: null,
    sort: "fit",
    summary: query.slice(0, 40),
  };
  const hour = q.match(/\b(an|one|1|two|2)\s*(hour|hr)s?\b/);
  return {
    ...base,
    category,
    cuisine,
    searchText: previous && category === previous.category ? base.searchText : `${cuisine ?? ""} ${category}`.trim(),
    price: /\b(cheap|cheaper|budget|inexpensive)\b/.test(q) ? "cheap" : /\b(fancy|upscale|nice)\b/.test(q) ? "upscale" : base.price,
    indoor: /\bindoors?\b|\brain\b/.test(q) ? true : /\boutdoors?\b/.test(q) ? false : base.indoor,
    quiet: /\b(quiet|calm|peaceful|uncrowded)\b/.test(q) || base.quiet,
    visitMin: hour ? (/(two|2)/.test(hour[1]) ? 120 : 60) : base.visitMin,
    meal: /\blunch\b/.test(q) ? "lunch" : /\bdinner\b/.test(q) ? "dinner" : base.meal,
    sort: /\bcloser|nearby|nearest\b/.test(q) ? "closer" : /\bcheaper\b/.test(q) ? "cheaper" : /\b(best|top|highest|better)\b/.test(q) ? "rating" : base.sort,
    summary: previous ? `${base.summary} · ${query}`.slice(0, 60) : query.slice(0, 60),
  };
}
