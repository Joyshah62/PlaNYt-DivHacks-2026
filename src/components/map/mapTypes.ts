import type { CategoryId, LatLon } from "@/lib/osm/types";

// Kept apart from CityMap so server-rendered code can use these without
// pulling MapLibre (which needs a browser) into the server bundle.

export interface MapHighlight {
  /** Categories to call out; null = none. */
  categories: CategoryId[] | null;
  cuisine: string | null;
  /** Specific places to call out (wins over categories). */
  ids: string[] | null;
}

export const NO_HIGHLIGHT: MapHighlight = { categories: null, cuisine: null, ids: null };

export interface MapDestination extends LatLon {
  id: string;
  label: string;
  custom: boolean;
}

/** What the camera should show. A new key refits; the same key leaves the reader's pan alone. */
export interface MapFrame {
  key: string;
  points: [number, number][];
  maxZoom?: number;
}

export type MapPick = { kind: "place" | "destination"; id: string } | null;
