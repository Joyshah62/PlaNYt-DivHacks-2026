import { WALKABLE_METERS, haversine, parseLatLon, pointKey } from "@/lib/osm/geo";
import { resolveDestination } from "@/lib/osm/nominatim";
import { osrmTable } from "@/lib/osm/osrm";
import { PRESET_DESTINATIONS } from "@/lib/osm/places";
import { buildCommuteReport, type CommuteTarget } from "@/lib/osm/report";
import type { CommuteReport } from "@/lib/osm/types";
import { decodePreferences } from "@/lib/preferences";

const cache = new Map<string, { report: CommuteReport; at: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const center = parseLatLon(params);
  if (!center) {
    return Response.json({ error: "A valid NYC latitude and longitude are required." }, { status: 400 });
  }

  const { destinations } = decodePreferences({ to: params.get("to") });
  const key = `${pointKey(center)}|${params.get("to") ?? ""}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return Response.json(cached.report);

  // Sequential on purpose: Nominatim allows one request a second.
  const custom: CommuteTarget[] = [];
  const unresolved: string[] = [];
  for (const [i, d] of destinations.entries()) {
    const point = await resolveDestination(d.text);
    if (point) custom.push({ id: `custom-${i}`, kind: d.kind, ...point });
    else unresolved.push(d.text);
  }

  const targets: CommuteTarget[] = [
    ...custom,
    ...PRESET_DESTINATIONS.map((p) => ({ id: p.id, label: p.label, kind: "preset" as const, lat: p.lat, lon: p.lon })),
  ];

  // Only route walks that could plausibly be walked; the rest have no walk time.
  const walkable = targets.filter((t) => haversine(center, t) <= WALKABLE_METERS);
  const [walkLegs, drive] = await Promise.all([
    osrmTable("foot", center, walkable),
    osrmTable("car", center, targets),
  ]);
  const walk = walkLegs && targets.map((t) => {
    const i = walkable.indexOf(t);
    return i === -1 ? { duration: null, distance: null } : walkLegs[i];
  });

  const report = buildCommuteReport({ center, targets, unresolved, walk, drive, now: new Date() });
  if (report.routingStatus.ok) cache.set(key, { report, at: Date.now() });
  return Response.json(report);
}
