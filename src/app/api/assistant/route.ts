import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { inNycArea } from "@/lib/osm/geo";
import { resolveDestination } from "@/lib/osm/nominatim";
import { ATTRACTIONS, ATTRACTION_BY_ID } from "@/lib/plan/attractions";
import { nycToday, toMinutes, WEEKDAYS, weekdayOf } from "@/lib/plan/time";
import type { AssistantResult, Choice, ChoiceOption, PointLabel, StopInput } from "@/lib/plan/types";

/**
 * POST /api/assistant { text } - turns "a chill Saturday, museums in the
 * morning, a view at sunset, I'll take the subway" into the planner's form.
 * Gemini only reads the request; the ordering and timing are computed by the
 * optimizer, so the plan is the same whether it was typed or clicked.
 */

const Place = {
  attractionId: z.string().nullable().describe("An id from the catalog, or null for a place not in it."),
  query: z.string().describe("The place's name as it would be searched on a map of NYC, e.g. \"Joe's Pizza, Carmine Street\"."),
};

const Understood = z.object({
  stops: z.array(
    z.object({
      ...Place,
      visitMin: z.number().nullable().describe("Minutes to spend there, only if the person implied a length."),
      fixedTime: z.string().nullable().describe("HH:MM 24-hour if it must start at a set time (a booking, a show), else null."),
      meal: z
        .enum(["lunch", "dinner"])
        .nullable()
        .describe("If this stop is where they'll eat a meal (a restaurant, pizza, a deli): \"dinner\" if they said dinner or evening, else \"lunch\". null for anything else, including a snack or dessert stop."),
      wish: z.string().nullable().describe("For a vague wish you filled, their wish in a few words, e.g. \"A skyline view\"; null for a place they named."),
      why: z.string().nullable().describe("For a vague wish: under 8 words on why this pick fits, e.g. \"The classic view, with Central Park\"."),
      alternatives: z
        .array(z.object({ ...Place, why: z.string().describe("Under 8 words on what makes this one different.") }))
        .describe("For a vague wish: 2 or 3 other good, different ways to satisfy it. Empty for a place they named."),
    }),
  ),
  date: z.string().nullable().describe("YYYY-MM-DD, or null if no day was mentioned."),
  startTime: z.string().nullable().describe("HH:MM 24-hour, or null."),
  endTime: z.string().nullable().describe("HH:MM 24-hour, or null."),
  mode: z.enum(["transit", "walk", "bike", "car"]).nullable(),
  crowd: z.enum(["avoid", "balanced", "ignore"]).nullable(),
  origin: z.string().nullable().describe("Where the day starts (hotel, address, neighborhood), or null."),
  pace: z.enum(["relaxed", "balanced", "packed"]).nullable(),
  group: z.enum(["solo", "couple", "family", "seniors"]).nullable(),
  walkMax: z.number().nullable().describe("Longest comfortable walk in minutes, only if stated or clearly implied."),
  interests: z.array(z.enum(["art", "views", "history", "outdoors", "food", "neighborhoods"])).nullable(),
  lunch: z.boolean().nullable().describe("true if they want a lunch break planned, false if they said no lunch, else null."),
  dinner: z.boolean().nullable().describe("true if they want a dinner break planned, false if they said no dinner, else null."),
  reply: z.string().describe("One or two friendly sentences: what you picked for anything vague, and any assumption you made."),
});

type Understood = z.infer<typeof Understood>;

const CATALOG = ATTRACTIONS.map((a) => `${a.id}: ${a.name} (${a.area}; ${a.kind}; ~${a.visitMin} min)`).join("\n");

const SYSTEM = `You help visitors plan a day in New York City. Read what the person wants and fill in the planner's fields. You do not order the stops or set times for them; a separate optimizer does that.

Stops:
- Use a catalog id whenever a catalog entry matches what they asked for. For vague wishes ("a great view", "some art", "a park"), choose the one catalog entry that fits best as the stop, and offer 2 or 3 genuinely different alternatives (a free one, a quieter one, one in another area). Prefer catalog entries for alternatives.
- For specific places that are not in the catalog (a restaurant, a shop, a bar), set attractionId to null and give a precise, searchable query that includes the NYC neighborhood or street.
- For vague food wishes ("good pizza", "bagels"), pick one well-known, long-running spot and name it precisely, with 2 or 3 alternatives in different neighborhoods.
- A place they named has no wish and no alternatives.
- At most 8 stops. Do not add stops they did not ask for, except to satisfy a vague wish.

Other fields:
- mode: "transit" means walking plus the subway. Default to null unless they said how they'll get around.
- crowd: "avoid" if they mention crowds, lines or wanting it calm; "ignore" if they say they don't mind; otherwise null.
- Dates and times: resolve relative days ("tomorrow", "Saturday") against today's date in the request. Leave anything unmentioned null.
- fixedTime: only for a stop with a set start ("ferry at 10", "Hamilton at 8pm"). A show or performance usually lasts about 150 minutes.
- Traveler: group "family" for children, "seniors" for older parents or grandparents, "couple" for two adults. pace "relaxed" for a slow or easy day, "packed" to see as much as possible. interests only when they say what they like. lunch/dinner true only if they mention eating or ask for meal breaks; a named restaurant is a stop, not a meal break.
- The request may include the traveler profile they already set; don't repeat it back unless their text changes it.

Catalog (id: name (area; kind; typical visit)):
${CATALOG}`;

const MODEL = "gemini-3.5-flash-lite";

/** The reply's shape, handed to Gemini as a JSON Schema so it answers in exactly this form. */
const UNDERSTOOD_SCHEMA: Record<string, unknown> = z.toJSONSchema(Understood);
// The dialect marker is for validators, not for the model.
delete UNDERSTOOD_SCHEMA.$schema;

let client: GoogleGenAI | null = null;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** Searched alternatives looked up per request, at about a second each. */
const MAX_ALTERNATIVE_LOOKUPS = 4;

/** A catalog entry, or a searched place found on the map in NYC; null if it can't be found. */
async function resolvePlace(p: { attractionId: string | null; query: string }, visit: number | null): Promise<StopInput | null> {
  const known = p.attractionId ? ATTRACTION_BY_ID.get(p.attractionId) : undefined;
  if (known) return { key: known.id, name: known.name, lat: known.lat, lon: known.lon, visitMin: visit ?? known.visitMin, attractionId: known.id };
  const point = await resolveDestination(p.query);
  if (!point || !inNycArea(point)) return null;
  return { key: `place-${slug(p.query)}`, name: p.query.split(",")[0].trim(), lat: point.lat, lon: point.lon, visitMin: visit ?? 60, attractionId: null };
}

export async function POST(request: Request) {
  let text = "";
  let context = "";
  try {
    const body = (await request.json()) as { text?: unknown; profile?: unknown };
    text = String(body.text ?? "").trim();
    // What the traveler already told us about themselves, so vague picks suit them.
    if (body.profile && typeof body.profile === "object") context = `\nTraveler profile already set: ${JSON.stringify(body.profile).slice(0, 300)}`;
  } catch {
    /* handled below */
  }
  if (text.length < 3) return Response.json({ error: "Tell me a little about your day." }, { status: 400 });
  if (text.length > 1500) return Response.json({ error: "That's a lot! Keep it under 1,500 characters." }, { status: 400 });

  const today = nycToday();
  let understood: Understood;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "The assistant isn't set up on this server. Pick your spots below instead." }, { status: 503 });
  }
  try {
    client ??= new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: MODEL,
      contents: `Today is ${WEEKDAYS[weekdayOf(today)]}, ${today}.${context}\n\n${text}`,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseJsonSchema: UNDERSTOOD_SCHEMA,
        abortSignal: AbortSignal.timeout(20_000),
      },
    });
    // The schema constrains the reply, but validate anyway: a truncated or
    // blocked response must not reach the planner as half a form.
    const parsed = Understood.safeParse(JSON.parse(response.text ?? "null"));
    if (!parsed.success) {
      console.error("[assistant] unusable reply", response.candidates?.[0]?.finishReason, parsed.error.issues[0]?.message);
      return Response.json({ error: "I couldn't turn that into a plan. Try naming a few places you'd like to see." }, { status: 422 });
    }
    understood = parsed.data;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error("[assistant]", error.status, error.message.slice(0, 300));
      if (error.status === 429) return Response.json({ error: "The assistant is busy. Try again in a moment." }, { status: 429 });
      if (error.status === 400 || error.status === 401 || error.status === 403) {
        return Response.json({ error: "The assistant isn't set up correctly on this server." }, { status: 503 });
      }
      return Response.json({ error: "The assistant couldn't be reached. Pick your spots below instead." }, { status: 502 });
    }
    // Malformed JSON, a timeout, or no network.
    console.error("[assistant]", error instanceof Error ? error.message : error);
    return Response.json({ error: "The assistant couldn't be reached. Pick your spots below instead." }, { status: 502 });
  }

  // Catalog stops are known; anything else is looked up (one a second, per Nominatim's policy).
  const stops: StopInput[] = [];
  const unresolved: string[] = [];
  const wishes: { stop: StopInput; wish: string; why: string | null; alternatives: Understood["stops"][number]["alternatives"] }[] = [];
  for (const s of understood.stops.slice(0, 10)) {
    const visit = s.visitMin ? Math.min(480, Math.max(10, Math.round(s.visitMin))) : null;
    const stop = await resolvePlace(s, visit);
    if (!stop) {
      unresolved.push(s.query);
      continue;
    }
    if (stops.some((x) => x.key === stop.key)) continue;
    stop.fixedStartMin = s.fixedTime ? toMinutes(s.fixedTime) : null;
    // A place to eat is the meal, so it lands at mealtime rather than wherever is quickest.
    if (s.meal && !stops.some((x) => x.mealFor === s.meal)) stop.mealFor = s.meal;
    stops.push(stop);
    if (s.wish && s.alternatives.length) wishes.push({ stop, wish: s.wish, why: s.why, alternatives: s.alternatives });
  }

  // Alternatives for vague wishes. Searched ones cost a geocoder call a second
  // each, so only the first few are looked up; catalog ones are free.
  const choices: Choice[] = [];
  let lookups = MAX_ALTERNATIVE_LOOKUPS;
  for (const { stop, wish, why, alternatives } of wishes) {
    const options: ChoiceOption[] = [{ ...stop, why: why ?? "Our pick" }];
    for (const alt of alternatives.slice(0, 3)) {
      const known = alt.attractionId ? ATTRACTION_BY_ID.get(alt.attractionId) : undefined;
      if (!known && lookups-- <= 0) continue;
      const option = await resolvePlace(alt, known ? null : stop.visitMin);
      if (!option || options.some((o) => o.key === option.key) || stops.some((x) => x.key === option.key)) continue;
      options.push({ ...option, why: alt.why });
    }
    if (options.length > 1) {
      choices.push({ id: `wish-${stop.key}`, kind: "wish", title: wish.charAt(0).toUpperCase() + wish.slice(1), currentKey: stop.key, options });
    }
  }

  let origin: PointLabel | null = null;
  if (understood.origin) {
    const point = await resolveDestination(understood.origin);
    if (point && inNycArea(point)) origin = { label: understood.origin, lat: point.lat, lon: point.lon };
    else unresolved.push(understood.origin);
  }

  const date = understood.date && /^\d{4}-\d{2}-\d{2}$/.test(understood.date) && understood.date >= today ? understood.date : null;
  const result: AssistantResult = {
    stops,
    unresolved,
    date,
    startMin: understood.startTime ? toMinutes(understood.startTime) : null,
    endMin: understood.endTime ? toMinutes(understood.endTime) : null,
    mode: understood.mode,
    crowd: understood.crowd,
    origin,
    profile: {
      ...(understood.pace && { pace: understood.pace }),
      ...(understood.group && { group: understood.group }),
      ...(understood.walkMax && understood.walkMax > 0 && { walkMax: Math.min(120, Math.max(5, Math.round(understood.walkMax))) }),
      ...(understood.interests?.length && { interests: understood.interests }),
    },
    meals: {
      ...(understood.lunch !== null && { lunch: understood.lunch }),
      ...(understood.dinner !== null && { dinner: understood.dinner }),
      // A place picked for a meal needs that meal in the day.
      ...Object.fromEntries(stops.flatMap((s) => (s.mealFor ? [[s.mealFor, true]] : []))),
    },
    choices,
    reply: understood.reply,
  };
  return Response.json(result);
}
