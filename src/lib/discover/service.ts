import { z } from "zod";
import { evaluate, resolveArea } from "@/lib/discover/evaluate";
import { IntentSchema, parseIntent } from "@/lib/discover/intent";
import { searchGoogle, searchLocal, searchOsm } from "@/lib/discover/sources";
import type { Area, DiscoverResponse, Intent } from "@/lib/discover/types";
import { buildPlan } from "@/lib/plan/build";
import { sharedLegs } from "@/lib/plan/compare";
import { PlanRequestSchema } from "@/lib/plan/schema";

export const AreaSchema = z.object({
  kind: z.enum(["trip", "stop", "origin", "here", "neighborhood"]),
  stopKey: z.string().max(80).optional(),
  neighborhood: z.string().max(80).optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
});

const DiscoverSchema = z.object({
  query: z.string().trim().min(2).max(300),
  request: PlanRequestSchema,
  area: AreaSchema,
  /** The search being refined, for follow-ups like "cheaper". */
  previous: IntentSchema.omit({ area: true }).nullable(),
  /** True when the reader picked the area; the words then don't move it. */
  areaPinned: z.boolean().default(false),
  reusePrevious: z.boolean().default(false),
  /** The traveler's position, for "near me" in the words. */
  here: z.object({ lat: z.number(), lon: z.number() }).nullable().optional(),
  placementPinned: z.boolean().default(false),
  placement: z.object({
    after: z.string().max(80).nullable(),
    preferredStartMin: z.number().int().min(0).max(1439).nullable(),
  }).optional(),
});

/**
 * POST /api/discover - "find something that fits my trip". The words become a
 * search; places come from Google Places (ratings, prices, hours) or
 * OpenStreetMap; the best few are tried in the real day by the planner, and
 * every line on a result card comes from that.
 */
export async function discover(body: unknown) {
  const parsed = DiscoverSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid search." }, { status: 400 });
  const { query, request, previous, areaPinned } = parsed.data;

  try {
    // The day as planned now, for the words ("after the Met") and the search area.
    const plan = await buildPlan(request, sharedLegs(request));
    const { intent: parsedIntent, area: said } = parsed.data.reusePrevious && previous
      ? { intent: previous as Intent, area: null }
      : await parseIntent(query, plan, previous as Intent | null);
    const intent = { ...parsedIntent };
    if (parsed.data.placementPinned && parsed.data.placement) intent.after = parsed.data.placement.after;
    if (intent.after && !plan.stops.some((s) => s.key === intent.after)) {
      return Response.json({ error: "That stop is no longer in your trip. Choose another placement." }, { status: 422 });
    }
    const preferredStartMin = parsed.data.placement?.preferredStartMin ?? null;
    if (preferredStartMin !== null && (preferredStartMin < request.startMin || preferredStartMin >= request.endMin)) {
      return Response.json({ error: "Choose a preferred time within your trip's start and end times." }, { status: 422 });
    }
    // The words can name a place to look ("in Williamsburg") unless the reader chose one.
    let area: Area = !areaPinned && said?.kind ? ({ ...parsed.data.area, ...said } as Area) : parsed.data.area;
    // "Near me" in the words needs the position the device shared.
    if (area.kind === "here" && area.lat === undefined) {
      const here = parsed.data.here;
      if (!here) return Response.json({ error: "I don't know where you are right now. Share your location, or name a street or neighborhood." }, { status: 422 });
      area = { ...area, lat: here.lat, lon: here.lon };
    }
    // "After the Met" on a trip-wide search looks wider around the Met and the stop after it.
    const where = await resolveArea(area, plan, intent.after);
    if (!where) return Response.json({ error: area.kind === "neighborhood" ? "Couldn't find that neighborhood in NYC." : area.kind === "here" ? "You seem to be outside New York City, so there's nothing near you to fit into this trip." : "That search area isn't available." }, { status: 422 });

    const google = await searchGoogle(where.points, intent);
    let candidates = google ?? [];
    let note: string | null = null;
    if (!google) {
      try {
        // The local copy of OpenStreetMap first; the live API only without one.
        candidates = (await searchLocal(where.points, intent)) ?? (await searchOsm(where.points, intent));
      } catch (error) {
        console.error("[discover] OSM search failed:", error instanceof Error ? error.message : error);
        return Response.json({ error: "The place search is busy right now. Try again in a moment." }, { status: 503 });
      }
    }
    const results = await evaluate(request, candidates, intent, preferredStartMin);
    if (!results.length) note = `Nothing matched ${where.label.toLowerCase()}. Try a wider area or different words.`;
    // Say what the data can't back, rather than implying it was used.
    else if (!google && (intent.price || intent.sort === "cheaper")) note = "Price levels aren't available from OpenStreetMap, so these aren't ranked by price.";
    else if (!google && (intent.sort === "rating" || intent.minRating)) note = "Ratings aren't available from OpenStreetMap, so these are ranked by how well they fit your day.";
    const response: DiscoverResponse = {
      intent,
      area: { ...area, label: where.label },
      results,
      source: google ? "google" : "openstreetmap",
      unrated: !results.some((r) => r.rating !== null),
      note,
    };
    return Response.json(response);
  } catch (error) {
    console.error("[discover]", error);
    return Response.json({ error: "Couldn't search right now." }, { status: 500 });
  }
}
