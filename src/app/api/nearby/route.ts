import { parseLatLon, pointKey } from "@/lib/osm/geo";
import { osrmTable } from "@/lib/osm/osrm";
import { RADIUS_METERS, fetchNearbyElements } from "@/lib/osm/overpass";
import { buildNearbyReport } from "@/lib/osm/report";
import type { NearbyReport } from "@/lib/osm/types";

/**
 * Same idea as the building report's cache: the public Overpass and OSRM servers
 * are shared, so repeat views of one address should never hit them twice.
 */
const cache = new Map<string, { report: NearbyReport; at: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function GET(request: Request) {
  const center = parseLatLon(new URL(request.url).searchParams);
  if (!center) {
    return Response.json({ error: "A valid NYC latitude and longitude are required." }, { status: 400 });
  }

  const key = pointKey(center);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return Response.json(cached.report);

  const { elements, status } = await fetchNearbyElements(center);
  const report = await buildNearbyReport({
    center,
    radiusMeters: RADIUS_METERS,
    elements,
    placesStatus: status,
    // Estimates are an honest fallback here (marked "~"); a slow router is not
    // worth holding the whole neighborhood section for.
    routeLegs: (routed) => osrmTable("foot", center, routed, { timeoutMs: 3500, retries: 0 }),
    now: new Date(),
  });

  // A failed lookup is retried next time rather than remembered.
  if (status.ok) cache.set(key, { report, at: Date.now() });
  return Response.json(report);
}
