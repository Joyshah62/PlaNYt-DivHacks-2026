/**
 * What discovery can look for, and how each kind maps to OpenStreetMap tags,
 * Google Places types, a typical visit, and whether it's indoors.
 */

export const CATEGORIES = ["restaurant", "cafe", "bar", "dessert", "museum", "gallery", "park", "viewpoint", "shopping", "activity", "landmark"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface CategoryDef {
  label: string;
  /** Overpass tag filters, e.g. `["amenity"="restaurant"]`. Any one matching is enough. */
  osm: string[];
  /** Google Places type for a text search, when one fits. */
  google: string | null;
  visitMin: number;
  indoor: boolean;
  food: boolean;
}

export const CATEGORY: Record<Category, CategoryDef> = {
  restaurant: { label: "Restaurant", osm: ['["amenity"~"^(restaurant|fast_food)$"]'], google: "restaurant", visitMin: 60, indoor: true, food: true },
  cafe: { label: "Café", osm: ['["amenity"="cafe"]'], google: "cafe", visitMin: 40, indoor: true, food: true },
  bar: { label: "Bar", osm: ['["amenity"~"^(bar|pub)$"]'], google: "bar", visitMin: 60, indoor: true, food: false },
  dessert: { label: "Dessert", osm: ['["amenity"="ice_cream"]', '["shop"~"^(bakery|pastry|confectionery|chocolate)$"]'], google: "bakery", visitMin: 30, indoor: true, food: true },
  museum: { label: "Museum", osm: ['["tourism"="museum"]'], google: "museum", visitMin: 90, indoor: true, food: false },
  gallery: { label: "Gallery", osm: ['["tourism"="gallery"]', '["shop"="art"]'], google: "art_gallery", visitMin: 45, indoor: true, food: false },
  park: { label: "Park", osm: ['["leisure"~"^(park|garden)$"]'], google: "park", visitMin: 45, indoor: false, food: false },
  viewpoint: { label: "Viewpoint", osm: ['["tourism"="viewpoint"]'], google: "tourist_attraction", visitMin: 40, indoor: false, food: false },
  shopping: {
    label: "Shopping",
    osm: ['["shop"~"^(clothes|books|gift|department_store|mall|boutique|shoes|jewelry|music|antiques|second_hand)$"]'],
    google: "store",
    visitMin: 60,
    indoor: true,
    food: false,
  },
  activity: {
    label: "Activity",
    // Things to drop into for an hour; ticketed shows (theatres, cinemas) need booking, not a detour.
    osm: ['["leisure"~"^(bowling_alley|amusement_arcade|escape_game|miniature_golf|ice_rink|trampoline_park)$"]', '["tourism"~"^(zoo|aquarium|theme_park)$"]', '["amenity"="planetarium"]'],
    google: null,
    visitMin: 60,
    indoor: true,
    food: false,
  },
  landmark: { label: "Landmark", osm: ['["tourism"="attraction"]', '["historic"~"^(monument|memorial|building)$"]'], google: "tourist_attraction", visitMin: 40, indoor: false, food: false },
};
