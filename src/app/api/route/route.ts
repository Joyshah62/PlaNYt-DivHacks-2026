import { inNycArea } from "@/lib/osm/geo";
import { osrmRoute } from "@/lib/osm/osrm";
import type { LatLon, RouteResult } from "@/lib/osm/types";

const cache = new Map<string, RouteResult>();

function point(raw: string | null): LatLon | null {
  const [lat, lon] = (raw ?? "").split(",").map(Number.parseFloat);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const p = { lat, lon };
  return inNycArea(p) ? p : null;
}

/** GET /api/route?from=lat,lon&to=lat,lon&mode=foot|bike|car - one drawable route. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = point(params.get("from"));
  const to = point(params.get("to"));
  const raw = params.get("mode");
  const mode = raw === "car" || raw === "bike" ? raw : "foot";
  if (!from || !to) return Response.json({ error: "Two NYC points are required." }, { status: 400 });

  const key = `${mode}|${from.lat.toFixed(5)},${from.lon.toFixed(5)}|${to.lat.toFixed(5)},${to.lon.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit) return Response.json(hit);

  const route = await osrmRoute(mode, from, to);
  if (!route) return Response.json({ error: "No route available right now." }, { status: 503 });
  // Bounded: routes are per place, and there are many places.
  if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
  cache.set(key, route);
  return Response.json(route);
}
