import { inNycArea } from "@/lib/osm/geo";
import { ATTRACTION_BY_ID, windowOn } from "@/lib/plan/attractions";
import { crowdProfile, levelDuring } from "@/lib/plan/crowd";
import { weekdayOf } from "@/lib/plan/time";

/**
 * GET /api/place?lat=..&lon=..&date=YYYY-MM-DD[&id=met][&visit=90]
 * Hours and hour-by-hour area busyness for one place on one day, plus the
 * quietest time to start a visit of that length while it is open.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const known = ATTRACTION_BY_ID.get(params.get("id") ?? "");
  const lat = known?.lat ?? Number.parseFloat(params.get("lat") ?? "");
  const lon = known?.lon ?? Number.parseFloat(params.get("lon") ?? "");
  const date = params.get("date") ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inNycArea({ lat, lon }) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "NYC coordinates and a date are required." }, { status: 400 });
  }
  const visit = Math.min(480, Math.max(15, Number.parseInt(params.get("visit") ?? "", 10) || known?.visitMin || 60));
  const dow = weekdayOf(date);
  const window = windowOn(known?.hours, dow);
  const crowd = crowdProfile({ lat, lon }, dow);

  let quietest: { startMin: number; level: number } | null = null;
  if (crowd && window !== null) {
    // Suggest times people actually visit, even where doors stay open past midnight.
    const [open, close] = window === "always" ? [7 * 60, 23 * 60] : [Math.max(7 * 60, window[0]), Math.min(23 * 60, window[1])];
    for (let s = Math.ceil(open / 60) * 60; s + visit <= close; s += 30) {
      const level = levelDuring(crowd.levels, s, s + visit);
      if (!quietest || level < quietest.level) quietest = { startMin: s, level };
    }
  }

  return Response.json({
    dow,
    window,
    week: known ? known.hours : null,
    crowd: crowd && { levels: crowd.levels, station: crowd.station, stationMeters: crowd.stationMeters },
    quietest,
  });
}
