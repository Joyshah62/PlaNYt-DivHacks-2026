import { inNycArea } from "@/lib/osm/geo";
import { resolveDestination } from "@/lib/osm/nominatim";

/** GET /api/resolve?q=... - one NYC place or address, for stops and starting points. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 160) return Response.json({ error: "Type a place or address." }, { status: 400 });
  const point = await resolveDestination(q);
  if (!point || !inNycArea(point)) return Response.json({ error: `Couldn't find "${q}" in New York City.` }, { status: 404 });
  return Response.json(point);
}
