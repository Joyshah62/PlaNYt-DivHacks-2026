import { after } from "next/server";
import { GEMINI_ASSISTANT_MODEL, GeminiError, geminiJson, geminiKey } from "@/lib/llm/gemini";
import { outsideTravelScope, SCOPE_REPLY, TRAVEL_SCOPE } from "@/lib/discover/scope";
import { recall, remember, rememberedFacts } from "@/lib/memory/backboard";
import { travelerMemory } from "@/lib/memory/traveler";
import { followUps } from "@/lib/plan/followUps";
import { oneMealEach } from "@/lib/plan/oneMeal";
import { partyFromText } from "@/lib/plan/party";
import { progressResponse, type Progress } from "@/lib/progress";
import { z } from "zod";
import { inNycArea } from "@/lib/osm/geo";
import { resolveDestination } from "@/lib/osm/nominatim";
import { nearbyWhy, placesNear } from "@/lib/discover/nearby";
import { nearestPicks } from "@/lib/plan/nearestPick";
import { ATTRACTIONS, ATTRACTION_BY_ID } from "@/lib/plan/attractions";
import { webSearch, webSearchEnabled } from "@/lib/web/tavily";
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
      nearMe: z
        .boolean()
        .describe("true for a kind of place they want near where they are right now (\"cafés near me\", \"pizza nearby\"). Then query is just the kind of place, e.g. \"café\", with no name or neighborhood, and there are no alternatives: a live search around them picks real places."),
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
  people: z.number().nullable().describe("How many are going in all, counting them, only if stated or clearly implied: \"me and my wife\" is 2, \"a family of four\" is 4, \"with my two kids\" is 3. null if unclear, e.g. just \"with my kids\" or \"with friends\"."),
  walkMax: z.number().nullable().describe("Longest comfortable walk in minutes, only if stated or clearly implied: \"keep walking manageable\" or \"not too much walking\" is 15, \"as little walking as possible\" is 10."),
  interests: z.array(z.enum(["art", "views", "history", "outdoors", "food", "neighborhoods"])).nullable(),
  lunch: z.boolean().nullable().describe("true if they want a lunch break planned, false if they said no lunch, else null."),
  dinner: z.boolean().nullable().describe("true if they want a dinner break planned, false if they said no dinner, else null."),
  reply: z.string().describe("One or two friendly sentences: what you picked for anything vague, and any assumption you made."),
  theme: z.string().nullish().describe("If the day is built around a theme (a TV show, film, book, person, era or scene, e.g. \"Friends\", \"Seinfeld\", \"Sex and the City\", \"the Gilded Age\", \"hip-hop history\"), its name; else null."),
});

type Understood = z.infer<typeof Understood>;

const CATALOG = ATTRACTIONS.map((a) => `${a.id}: ${a.name} (${a.area}; ${a.kind}; ~${a.visitMin} min)`).join("\n");

const SYSTEM = `You are Roam AI, a warm, thoughtful NYC day-planning companion. Sound natural and personal, with brief empathy when it fits, without pretending to have human experiences. If a remembered preference materially shaped a choice, say so conversationally ("Since you mentioned you like quieter places...") and invite correction if it may have changed. Don't announce memory when it didn't affect the plan.
You help visitors plan a day in New York City. Read what the person wants and fill in the planner's fields. You do not order the stops or set times for them; a separate optimizer does that.

Stops:
- Use a catalog id whenever a catalog entry matches what they asked for. For vague wishes ("a great view", "some art", "a park"), choose the one catalog entry that fits best as the stop, and offer 2 or 3 genuinely different alternatives (a free one, a quieter one, one near the other places they asked for). Prefer catalog entries for alternatives. Nobody should cross the city for a vague wish: favour picks near the rest of their day, unless they asked for a particular area.
- For specific places that are not in the catalog (a restaurant, a shop, a bar), set attractionId to null and give a precise, searchable query that includes the NYC neighborhood or street.
- For vague food wishes ("good pizza", "bagels"), pick one well-known, long-running spot and name it precisely, with 2 or 3 alternatives, at least one of them near the other places in their day. Prefer a spot near the rest of their day over a more famous one across town.
- A place they named has no wish and no alternatives.
- "Near me", "nearby" or "around here" means where they are right now, not a neighborhood you know: set nearMe, never name a place for it, and don't mention a specific place for it in your reply.
- A themed day ("a Friends day", "Seinfeld spots", "Gossip Girl") means the places that theme is known for in New York, by their real names (Monk's Café is Tom's Restaurant): include the best-known ones even if they only named the theme (aim for 5 to 7 that make a good day, plus somewhere to eat that fits it), and don't take the theme's words literally. If the request comes with notes from a web search, trust them over memory, and say in the reply if something they expect isn't in New York (the Friends fountain is in Burbank; Cherry Hill Fountain in Central Park is the look-alike).
- At most 8 stops. Do not add stops they did not ask for, except to satisfy a vague wish or a theme.

Other fields:
- Never assume party size from "I", "we", a student identity, the default profile, or past trips. Group and people must be null unless this request explicitly identifies the party. Do not invent a spending limit, total budget or per-person budget. Do not mention group size or a budget in your reply unless the traveler supplied it.
- mode: "transit" means walking plus the subway. Default to null unless they said how they'll get around.
- crowd: "avoid" if they mention crowds, lines or wanting it calm; "ignore" if they say they don't mind; otherwise null.
- Dates and times: resolve relative days ("tomorrow", "Saturday") against today's date in the request. Leave anything unmentioned null.
- fixedTime: only for a stop with a set start ("ferry at 10", "Hamilton at 8pm"). A show or performance usually lasts about 150 minutes.
- Traveler: group "family" for children, "seniors" for older parents or grandparents, "couple" only for two partners travelling together. For friends, colleagues or a group whose makeup isn't clear, group is null (never "couple"). pace "relaxed" for a slow or easy day, "packed" to see as much as possible. interests only when they say what they like. lunch/dinner true only if they mention eating or ask for meal breaks; a named restaurant is a stop, not a meal break.
- The request may include the traveler profile they already set; don't repeat it back unless their text changes it.

Catalog (id: name (area; kind; typical visit)):
${CATALOG}`;


/** The reply's shape, handed to Gemini as a JSON Schema so it answers in exactly this form. */
const UNDERSTOOD_SCHEMA: Record<string, unknown> = z.toJSONSchema(Understood);
// The dialect marker is for validators, not for the model.
delete UNDERSTOOD_SCHEMA.$schema;


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

/**
 * For "near me", say what the live search found rather than the model's guess
 * at it: the model never sees the results.
 */
function nearReply(understood: Understood, here: { lat: number; lon: number } | null, near: Choice[], stops: StopInput[]): string | null {
  if (!understood.stops.some((s) => s.nearMe)) return null;
  if (!here) return "I need your location to find places near you. Allow location access when your browser asks, or name a neighborhood, like \"cafés in Morningside Heights\".";
  const found = near.flatMap((c) => {
    const pick = c.options.find((o) => o.key === c.currentKey);
    return pick ? [`${pick.name} (${pick.why})`] : [];
  });
  const alone = stops.filter((s) => !near.some((c) => c.currentKey === s.key)).length === 0;
  if (!found.length) return "I couldn't find a good match close to you. Try a wider search, or name a neighborhood.";
  return `Closest good pick: ${found.join(" and ")}. Tap it to see ${found.length > 1 ? "other nearby options" : "a few other spots nearby"}.${alone ? " Your day starts from where you are." : ""}`;
}

export async function POST(request: Request) {
  return progressResponse(request, (progress) => assistant(request, progress));
}

async function assistant(request: Request, progress: Progress) {
  progress("Reading your request…");
  let text = "";
  let context = "";
  // Where they are, when the device shared it and it's in the city.
  let here: { lat: number; lon: number } | null = null;
  let memoryId: unknown = null;
  // Asked once: the second time round, they've answered or chosen to skip.
  let askFirst = true;
  // Who's coming is already known from a profile they set.
  let knowsGroup = false;
  try {
    const body = (await request.json()) as { text?: unknown; profile?: unknown; here?: { lat?: unknown; lon?: unknown } | null; memoryId?: unknown; skipQuestions?: unknown; knowsGroup?: unknown };
    memoryId = body.memoryId;
    askFirst = body.skipQuestions !== true;
    text = String(body.text ?? "").trim();
    const lat = Number(body.here?.lat);
    const lon = Number(body.here?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon) && inNycArea({ lat, lon })) here = { lat, lon };
    // What the traveler already told us about themselves, so vague picks suit them.
    if (body.profile && typeof body.profile === "object") context = `\nTravel preferences: ${JSON.stringify(Object.fromEntries(Object.entries(body.profile).filter(([key]) => !["group", "people"].includes(key)))).slice(0, 300)}`;
  } catch {
    /* handled below */
  }
  if (text.length < 3) return Response.json({ error: "Tell me a little about your day." }, { status: 400 });
  if (text.length > 1500) return Response.json({ error: "That's a lot! Keep it under 1,500 characters." }, { status: 400 });
  if (outsideTravelScope(text)) return Response.json({ error: SCOPE_REPLY }, { status: 422 });

  const today = nycToday();
  const party = partyFromText(text);
  knowsGroup = !!party.group || !!party.people;
  let understood: Understood;
  if (!geminiKey()) {
    return Response.json({ error: "The assistant isn't set up on this server. Pick your spots below instead." }, { status: 503 });
  }
  progress("Loading your travel preferences…");
  const { memoryId: memory, onAccount } = await travelerMemory(request, memoryId);
  // What they told Roam AI on earlier trips, so a vague "somewhere for lunch" suits them too.
  const remembered = rememberedFacts(await recall(memory, text));
  after(() => remember(memory, text));
  try {
    progress("Working out your day…");
    const read = async (notes: string) =>
      Understood.safeParse(
        await geminiJson(
          `${TRAVEL_SCOPE}\n\n${SYSTEM}${remembered}`,
          `Today is ${WEEKDAYS[weekdayOf(today)]}, ${today}.${context}\n${here ? "The traveler shared where they are right now." : "The traveler's current location is unknown."}${notes}\n\n${text}`,
          { name: "day_request", schema: UNDERSTOOD_SCHEMA },
          // Reading a request into fields needs little deliberation; the planner does the thinking.
          { timeoutMs: 25_000, effort: "low", model: GEMINI_ASSISTANT_MODEL },
        ),
      );
    // The schema constrains the reply, but validate anyway: a truncated or
    // refused response must not reach the planner as half a form.
    const parsed = await read("");
    if (!parsed.success) {
      console.error("[assistant] unusable reply", parsed.error.issues[0]?.message);
      return Response.json({ error: "I couldn't turn that into a plan. Try naming a few places you'd like to see." }, { status: 422 });
    }
    understood = parsed.data;
    // A themed day is grounded in what the web says the theme's places are, not the model's
    // memory: it neither takes the theme literally nor leaves out what fans go for.
    const theme = understood.theme?.trim();
    if (theme && webSearchEnabled()) {
      progress(`Checking where ${theme} fans go in New York…`);
      const web = await webSearch(`${theme} New York City filming locations and places fans visit`);
      if (web?.results.length) {
        const notes = [web.answer, ...web.results.map((w) => `${w.title}: ${w.content}`)].filter(Boolean).join("\n").slice(0, 3500);
        const grounded = await read(`\n\nNotes from a web search on "${theme}" places in New York (use them for the theme's stops):\n${notes}`).catch(() => null);
        if (grounded?.success) understood = grounded.data;
      }
    }
    // Enforce explicit party evidence even when the model fills in defaults.
    understood.group = party.group && party.group !== "unspecified" ? party.group : null;
    understood.people = party.people ?? null;
  } catch (error) {
    if (error instanceof GeminiError && error.status !== null) {
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

  // When and who change the whole day; a request that leaves them out gets asked before it's planned.
  const questions = askFirst ? followUps({ date: understood.date, group: understood.group, nearMe: understood.stops.some((s) => s.nearMe) }, { today, knowsGroup }) : [];
  if (questions.length) {
    const asking: AssistantResult = {
      stops: [], unresolved: [], date: null, startMin: null, endMin: null, mode: null, crowd: null, origin: null, profile: {}, meals: {}, choices: [],
      reply: questions.length > 1 ? "Two quick questions so the day fits you." : "One quick question so the day fits you.",
      questions,
      ...(memory && !onAccount && { memoryId: memory }),
    };
    return Response.json(asking);
  }

  // Catalog stops are known; anything else is looked up (one a second, per Nominatim's policy).
  progress("Finding places and checking locations…");
  const stops: StopInput[] = [];
  const unresolved: string[] = [];
  const wishes: { stop: StopInput; wish: string; why: string | null; alternatives: Understood["stops"][number]["alternatives"] }[] = [];
  const nearChoices: Choice[] = [];
  for (const s of oneMealEach(understood.stops).slice(0, 10)) {
    const visit = s.visitMin ? Math.min(480, Math.max(10, Math.round(s.visitMin))) : null;
    if (s.nearMe) {
      // Real places around them, from the places API, never a famous one from memory.
      const near = here ? await placesNear(here, s.query) : [];
      if (!near.length) {
        unresolved.push(here ? `${s.query} near you` : `${s.query} near you (allow location access, or name a neighborhood)`);
        continue;
      }
      const [pick, ...others] = near.map((c): ChoiceOption => ({ key: `place-${slug(c.name)}`, name: c.name, lat: c.lat, lon: c.lon, visitMin: visit ?? 45, attractionId: null, why: nearbyWhy(c) }));
      if (stops.some((x) => x.key === pick.key)) continue;
      const stop: StopInput = { key: pick.key, name: pick.name, lat: pick.lat, lon: pick.lon, visitMin: pick.visitMin, attractionId: null };
      if (s.meal && !stops.some((x) => x.mealFor === s.meal)) stop.mealFor = s.meal;
      stops.push(stop);
      const wish = `${s.query.charAt(0).toUpperCase()}${s.query.slice(1)} near you`;
      if (others.length) nearChoices.push({ id: `wish-${stop.key}`, kind: "wish", title: wish, currentKey: stop.key, options: [pick, ...others.filter((o) => o.key !== pick.key)] });
      continue;
    }
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
  const choices: Choice[] = [...nearChoices];
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

  // Looking around where they are means the day starts there.
  let origin: PointLabel | null = here && !understood.origin && understood.stops.some((s) => s.nearMe) ? { label: "Your location", ...here } : null;
  if (understood.origin) {
    const point = await resolveDestination(understood.origin);
    if (point && inNycArea(point)) origin = { label: understood.origin, lat: point.lat, lon: point.lon };
    else unresolved.push(understood.origin);
  }

  // Every option for a vague wish is a good one: take the one nearest the rest of the day, so
  // nobody crosses the city for "good pizza". Places they named, and near-me picks, stay put.
  const vague = choices.filter((c) => c.kind === "wish" && !nearChoices.includes(c) && c.currentKey);
  const wishKeys = new Set(vague.map((c) => c.currentKey));
  const fixed = [...stops.filter((s) => !wishKeys.has(s.key)), ...(origin ? [origin] : [])];
  const swapped: string[] = [];
  nearestPicks(fixed, vague.map((c) => ({ current: c.currentKey!, options: c.options }))).forEach((key, i) => {
    const choice = vague[i];
    if (key === choice.currentKey) return;
    const at = stops.findIndex((s) => s.key === choice.currentKey);
    const pick = choice.options.find((o) => o.key === key)!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { why, ...stop } = pick;
    swapped.push(`${stop.name} instead of ${stops[at].name}`);
    stops[at] = { ...stop, fixedStartMin: stops[at].fixedStartMin ?? null, mealFor: stops[at].mealFor ?? null };
    choice.currentKey = key;
  });

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
      ...(understood.people && understood.people >= 1 && { people: Math.min(20, Math.round(understood.people)) }),
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
    reply: nearReply(understood, here, nearChoices, stops) ?? (swapped.length ? `${understood.reply} I went with ${swapped.join(", and ")}, so you're not crossing town for it.` : understood.reply),
    ...(memory && !onAccount && { memoryId: memory }),
  };
  return Response.json(result);
}
