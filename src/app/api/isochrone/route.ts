import { parseLatLon, pointKey } from "@/lib/osm/geo";
import { fetchIsochrones, type IsochroneCollection } from "@/lib/osm/isochrone";

const cache = new Map<string, IsochroneCollection>();

/** Walking-time areas for the map. 204 means "draw the circle fallback". */
export async function GET(request: Request) {
  const center = parseLatLon(new URL(request.url).searchParams);
  if (!center) return Response.json({ error: "A valid NYC latitude and longitude are required." }, { status: 400 });

  const key = pointKey(center);
  const hit = cache.get(key);
  if (hit) return Response.json(hit);

  const zones = await fetchIsochrones(center);
  if (!zones) return new Response(null, { status: 204 });
  cache.set(key, zones);
  return Response.json(zones);
}
