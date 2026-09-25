import { estimateWalkMin, haversine } from "./geo";
import type {
  CategoryId,
  CategorySummary,
  CuisineCount,
  LatLon,
  Place,
} from "./types";

/** Display order, and the one place category labels live. */
export const CATEGORIES: { id: CategoryId; label: string; singular: string }[] = [
  { id: "groceries", label: "Groceries", singular: "grocery store" },
  { id: "restaurants", label: "Restaurants", singular: "restaurant" },
  { id: "coffee", label: "Coffee", singular: "café" },
  { id: "subway", label: "Subway & rail", singular: "station" },
  { id: "parks", label: "Parks", singular: "park" },
  { id: "fitness", label: "Fitness", singular: "gym" },
  { id: "pharmacy", label: "Pharmacy", singular: "pharmacy" },
  { id: "nightlife", label: "Nightlife", singular: "bar" },
  { id: "convenience", label: "Corner stores", singular: "corner store" },
  { id: "laundry", label: "Laundry", singular: "laundromat" },
  { id: "entertainment", label: "Culture", singular: "venue" },
  { id: "health", label: "Healthcare", singular: "clinic" },
  { id: "bus", label: "Bus stops", singular: "bus stop" },
];

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export type OsmTags = Record<string, string | undefined>;

/** Tags → one app category. Order matters: the first rule that matches wins. */
export function categorize(tags: OsmTags): CategoryId | null {
  const { amenity, shop, leisure, railway, highway, tourism } = tags;

  if (railway === "station" || (tags.public_transport === "station" && tags.station)) {
    return "subway";
  }
  if (highway === "bus_stop") return "bus";

  switch (shop) {
    case "supermarket":
    case "grocery":
    case "greengrocer":
      return "groceries";
    case "convenience":
      return "convenience";
    case "laundry":
      return "laundry";
  }

  switch (amenity) {
    case "restaurant":
    case "fast_food":
      return "restaurants";
    case "cafe":
      return "coffee";
    case "bar":
    case "pub":
    case "nightclub":
      return "nightlife";
    case "pharmacy":
      return "pharmacy";
    case "hospital":
    case "clinic":
      return "health";
    case "cinema":
    case "theatre":
      return "entertainment";
  }

  if (tourism === "museum") return "entertainment";
  if (leisure === "fitness_centre" || leisure === "sports_centre") return "fitness";
  if (leisure === "park" || leisure === "playground") return "parks";

  return null;
}

/**
 * OSM `cuisine` is free-form and often multi-valued ("indian;pakistani"). We
 * bucket into the groups people actually search for.
 */
const CUISINE_BUCKETS: Record<string, string[]> = {
  indian: ["indian", "pakistani", "bangladeshi", "nepalese", "south_indian", "north_indian", "punjabi", "sri_lankan"],
  chinese: ["chinese", "cantonese", "sichuan", "dim_sum", "dumpling", "szechuan", "hunan", "taiwanese"],
  japanese: ["japanese", "sushi", "ramen", "udon"],
  korean: ["korean"],
  thai: ["thai"],
  vietnamese: ["vietnamese", "pho"],
  italian: ["italian", "pasta"],
  pizza: ["pizza"],
  mexican: ["mexican", "tex-mex", "tacos", "burrito"],
  caribbean: ["caribbean", "jamaican", "haitian", "trinidadian", "west_indian"],
  latin: ["latin_american", "dominican", "puerto_rican", "peruvian", "colombian", "ecuadorian", "spanish", "venezuelan", "cuban"],
  mediterranean: ["greek", "mediterranean", "middle_eastern", "turkish", "lebanese", "falafel", "kebab", "israeli", "arab", "halal"],
  american: ["american", "burger", "diner", "bagel", "sandwich", "deli", "barbecue", "bbq", "steak_house"],
  chicken: ["chicken", "fried_chicken", "wings"],
  african: ["african", "ethiopian", "nigerian", "senegalese", "ghanaian"],
};

/** Buckets that make up "Asian food". */
export const ASIAN_CUISINES = ["chinese", "japanese", "korean", "thai", "vietnamese"];

export const CUISINE_LABELS: Record<string, string> = {
  indian: "Indian",
  chinese: "Chinese",
  japanese: "Japanese",
  korean: "Korean",
  thai: "Thai",
  vietnamese: "Vietnamese",
  italian: "Italian",
  pizza: "Pizza",
  mexican: "Mexican",
  caribbean: "Caribbean",
  latin: "Latin",
  mediterranean: "Mediterranean",
  american: "American",
  chicken: "Chicken",
  african: "African",
};

export function normalizeCuisine(raw: string | undefined): string | null {
  if (!raw) return null;
  const parts = raw.toLowerCase().split(/[;,]/).map((p) => p.trim());
  for (const part of parts) {
    for (const [bucket, members] of Object.entries(CUISINE_BUCKETS)) {
      if (members.includes(part)) return bucket;
    }
  }
  return null;
}

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
}

/** Overpass elements → categorized, deduplicated places, nearest first. */
export function toPlaces(elements: OverpassElement[], center: LatLon): Place[] {
  const places: Place[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;

    const category = categorize(tags);
    if (!category) continue;

    // An unnamed bus stop is still a bus stop; an unnamed restaurant is noise
    // we cannot show anyone.
    const name = tags.name?.trim() || (category === "bus" ? "Bus stop" : null);
    if (!name) continue;

    const meters = Math.round(haversine(center, { lat, lon }));
    const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
    const website = tags.website ?? tags["contact:website"];
    const phone = tags.phone ?? tags["contact:phone"];
    places.push({
      id: `${el.type}/${el.id}`,
      name,
      category,
      cuisine: category === "restaurants" ? normalizeCuisine(tags.cuisine) : null,
      lat,
      lon,
      meters,
      walkMin: estimateWalkMin(meters),
      estimated: true,
      ...(tags.opening_hours && { hours: tags.opening_hours }),
      ...(website && /^https?:\/\//.test(website) && { website }),
      ...(phone && { phone }),
      ...(street && { street }),
    });
  }

  places.sort((a, b) => a.meters - b.meters);
  return dedupe(places);
}

/**
 * OSM often maps one business twice (a node and its building), and one subway
 * station per line. Same category + same name within 60 m is one place.
 */
export function dedupe(sorted: Place[]): Place[] {
  const kept: Place[] = [];
  for (const place of sorted) {
    const key = place.name.toLowerCase();
    const duplicate = kept.some(
      (k) =>
        k.category === place.category &&
        k.name.toLowerCase() === key &&
        haversine(k, place) < 60,
    );
    if (!duplicate) kept.push(place);
  }
  return kept;
}

export const NEAREST_PER_CATEGORY = 3;

export function summarize(places: Place[]): CategorySummary[] {
  return CATEGORIES.map(({ id }) => {
    const inCategory = places.filter((p) => p.category === id);
    const within = (min: number) => inCategory.filter((p) => p.walkMin <= min).length;
    return {
      id,
      within5: within(5),
      within10: within(10),
      within15: within(15),
      // Routing can reorder the closest few: 200 m across a highway loses to 300 m down the block.
      nearest: inCategory
        .slice(0, NEAREST_PER_CATEGORY)
        .sort((a, b) => a.walkMin - b.walkMin || a.meters - b.meters),
      cuisines: id === "restaurants" ? cuisineCounts(inCategory) : [],
    };
  });
}

function cuisineCounts(restaurants: Place[]): CuisineCount[] {
  const counts = new Map<string, number>();
  for (const r of restaurants) {
    if (!r.cuisine || r.walkMin > 15) continue;
    counts.set(r.cuisine, (counts.get(r.cuisine) ?? 0) + 1);
  }
  return [...counts]
    .map(([cuisine, count]) => ({ cuisine, count }))
    .sort((a, b) => b.count - a.count || a.cuisine.localeCompare(b.cuisine));
}
