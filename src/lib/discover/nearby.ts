import type { LatLon } from "@/lib/osm/types";
import { fallbackIntent } from "./intent";
import { searchGoogle, searchLocal, searchOsm } from "./sources";
import type { Candidate } from "./types";

/** "Near me" means a short walk. */
export const NEAR_RADIUS_M = 800;

/** Good and close: a strong rating from many reviews, less a little for each block away. */
function score(c: Candidate): number {
  const quality = c.rating !== null ? c.rating - 3.5 + 0.3 * Math.log10((c.reviews ?? 0) + 1) : 0;
  return quality - (c.meters / 1000) * 0.8;
}

/**
 * Real places of a kind ("café", "pizza") around a point, best first: from
 * Google Places when it's set up, else OpenStreetMap. Nothing is invented and
 * nothing far away gets in.
 */
export async function placesNear(here: LatLon, what: string, limit = 4): Promise<Candidate[]> {
  const intent = fallbackIntent(what, null);
  const points = [{ ...here, radius: NEAR_RADIUS_M }];
  let found = await searchGoogle(points, intent);
  if (!found?.length) found = (await searchLocal(points, intent)) ?? (await searchOsm(points, intent).catch(() => []));
  return found
    .filter((c) => c.meters <= NEAR_RADIUS_M * 1.25)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

/** "4.6★ · 300 m away", for why a place was picked. */
export function nearbyWhy(c: Candidate): string {
  const walk = c.meters < 100 ? "Right by you" : `${Math.round(c.meters / 50) * 50} m away`;
  return c.rating !== null ? `${c.rating.toFixed(1)}★ · ${walk}` : walk;
}
