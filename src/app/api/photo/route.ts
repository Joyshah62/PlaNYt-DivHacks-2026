import { inNycArea } from "@/lib/osm/geo";
import { ATTRACTION_BY_ID } from "@/lib/plan/attractions";
import { photoFor } from "@/lib/plan/photos";

/** GET /api/photo?id=met  or  ?name=Joe's Pizza&lat=..&lon=.. - one photo, with its credit. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const known = ATTRACTION_BY_ID.get(params.get("id") ?? "");
  const lat = Number.parseFloat(params.get("lat") ?? "");
  const lon = Number.parseFloat(params.get("lon") ?? "");
  const name = params.get("name")?.trim().slice(0, 120) ?? "";
  const place = known
    ? { attractionId: known.id, name: known.name, lat: known.lat, lon: known.lon }
    : name && Number.isFinite(lat) && Number.isFinite(lon) && inNycArea({ lat, lon })
      ? { attractionId: null, name, lat, lon }
      : null;
  if (!place) return Response.json({ error: "A catalog id, or a name with NYC coordinates, is required." }, { status: 400 });

  const photo = await photoFor(place);
  if (!photo) return Response.json({ error: "No photo for this place." }, { status: 404 });
  return Response.json(photo, { headers: { "Cache-Control": "private, max-age=3600" } });
}
