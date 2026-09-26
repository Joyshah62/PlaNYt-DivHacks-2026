import { STATIONS } from "@/lib/plan/crowd";

/**
 * GET /api/crowd-heat?dow=0..6 - every subway station's riders for each hour of
 * that weekday, scaled against the busiest station-hour of the day (0..1, square
 * root so quieter areas still show). Drawn on the map as the city's pulse.
 */
export async function GET(request: Request) {
  const dow = Number.parseInt(new URL(request.url).searchParams.get("dow") ?? "", 10);
  if (!(dow >= 0 && dow <= 6)) return Response.json({ error: "dow must be 0-6." }, { status: 400 });
  const rows = STATIONS.map((s) => ({ s, hours: s.riders.slice(dow * 24, dow * 24 + 24) }));
  const peak = Math.max(1, ...rows.flatMap((r) => r.hours));
  const stations = rows.map(({ s, hours }) => [
    Math.round(s.lon * 1e5) / 1e5,
    Math.round(s.lat * 1e5) / 1e5,
    ...hours.map((h) => Math.round(Math.sqrt(h / peak) * 100) / 100),
  ]);
  return Response.json({ stations }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
