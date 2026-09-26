import { estimateWalkMin, haversine, parseLatLon } from "@/lib/osm/geo";
import { nearbyEateries, type Eatery } from "@/lib/osm/overpass";
import { ATTRACTIONS } from "@/lib/plan/attractions";
import { MEAL_WINDOW } from "@/lib/plan/profile";
import type { ChoiceOption, MealKind } from "@/lib/plan/types";

const MAX_OPTIONS = 4;
const AMENITY_LABEL: Record<string, string> = { restaurant: "Restaurant", cafe: "Café", fast_food: "Quick bite" };

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const walk = (meters: number) => `${estimateWalkMin(meters)} min walk`;

/** Nearer is better; a named cuisine says more on a card; cafés suit lunch more than dinner. */
function rank(e: Eatery, meal: MealKind): number {
  return e.meters + (e.cuisine ? 0 : 150) + (e.amenity === "cafe" ? 120 : e.amenity === "fast_food" && meal === "dinner" ? 200 : 0);
}

/**
 * GET /api/food?lat=..&lon=..&meal=lunch|dinner[&exclude=key,key]
 * A few places to eat around where a meal falls, as options for the day: the
 * catalog's food spots nearby first, then OpenStreetMap, one per cuisine.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const point = parseLatLon(params);
  const meal = params.get("meal");
  if (!point || (meal !== "lunch" && meal !== "dinner")) {
    return Response.json({ error: "NYC coordinates and a meal are required." }, { status: 400 });
  }
  const exclude = new Set((params.get("exclude") ?? "").split(",").filter(Boolean));
  const visitMin = MEAL_WINDOW[meal].visitMin;
  const options: ChoiceOption[] = [];

  // The nearest hand-picked food spot, if one is a short walk away.
  const [pick] = ATTRACTIONS.filter((a) => a.kind === "food" && !exclude.has(a.id))
    .map((a) => ({ a, meters: haversine(point, a) }))
    .filter((x) => x.meters <= 1500)
    .sort((x, y) => x.meters - y.meters);
  if (pick) {
    const { a, meters } = pick;
    options.push({ key: a.id, name: a.name, lat: a.lat, lon: a.lon, visitMin, attractionId: a.id, mealFor: meal, why: `${a.blurb.replace(/\.$/, "")} · ${walk(meters)}` });
  }

  const eateries = (await nearbyEateries(point))
    .filter((e) => (meal === "lunch" || e.amenity !== "cafe") && !exclude.has(`food-${e.id}`))
    .sort((a, b) => rank(a, meal) - rank(b, meal));
  const cuisines = new Set<string>();
  for (const e of eateries) {
    if (options.length >= MAX_OPTIONS) break;
    const kind = e.cuisine ?? e.amenity;
    if (cuisines.has(kind)) continue;
    cuisines.add(kind);
    options.push({
      key: `food-${e.id}`,
      name: e.name,
      lat: e.lat,
      lon: e.lon,
      visitMin: e.amenity === "restaurant" ? visitMin : 40,
      attractionId: null,
      mealFor: meal,
      why: `${e.cuisine ? capitalize(e.cuisine) : (AMENITY_LABEL[e.amenity] ?? "Food")} · ${walk(e.meters)}`,
    });
  }
  return Response.json({ options });
}
