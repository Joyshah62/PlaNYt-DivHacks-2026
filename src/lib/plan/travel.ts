import { estimateDriveMin, estimateWalkMin, haversine, pointKey } from "@/lib/osm/geo";
import { osrmMatrix, type Profile } from "@/lib/osm/osrm";
import type { LatLon } from "@/lib/osm/types";
import { nearestStations, STATIONS, type Station } from "./crowd";
import type { Leg, PointLabel, Ride, TravelMode } from "./types";

/**
 * Minutes between every pair of points for one travel mode.
 *
 * Walking, cycling and driving are routed on OpenStreetMap by OSRM. The subway
 * is estimated: walk to one of the nearest stations, wait, ride at the system's
 * average speed (changing trains once if the stations share no line), walk out.
 * There is no timetable behind it, so those legs are always marked estimated. "transit" takes whichever of walking
 * and the subway is faster for each leg, the way a New Yorker would.
 */

/** Averages including stops: express trunk lines about 20 mph, locals about 15. */
const EXPRESS_M_PER_MIN = 540;
const LOCAL_M_PER_MIN = 420;
const EXPRESS_LINES = new Set(["2", "3", "4", "5", "A", "D", "Q"]);
/** Track runs longer than the straight line. */
const TRACK_DETOUR = 1.25;
/** Typical daytime headway / 2, plus getting to the platform. */
const SUBWAY_WAIT_MIN = 6;
/** Walking between platforms and waiting again. */
const TRANSFER_MIN = 6;
/** Take the train only when it saves real time over walking. */
const SUBWAY_MIN_SAVING = 4;

const BIKE_M_PER_MIN = 230;
/** OSRM drives at free-flow speeds; NYC does not. */
const TRAFFIC_FACTOR = 1.4;
/** Finding a spot and walking from it. */
const PARKING_MIN = 8;

function estimate(mode: "walk" | "bike" | "car", meters: number): Leg {
  const minutes =
    mode === "walk" ? estimateWalkMin(meters)
      : mode === "bike" ? Math.max(1, Math.round((meters * 1.3) / BIKE_M_PER_MIN))
        : estimateDriveMin(meters) + PARKING_MIN;
  return { mode, minutes, meters: Math.round(meters * 1.3), estimated: true };
}

/** "77 St (6)" -> { name: "77 St", lines: ["6"] }. Every MTA station complex name ends in its lines. */
export function stationLines(name: string): { name: string; lines: string[] } {
  const match = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(name);
  if (!match) return { name, lines: [] };
  return { name: match[1], lines: match[2].split(",").map((l) => l.trim()).filter(Boolean) };
}

const LINES = new Map(STATIONS.map((s) => [s.id, stationLines(s.name)]));
const shared = (a: string[], b: string[]) => a.filter((l) => b.includes(l));

function label(s: Station): PointLabel {
  return { label: LINES.get(s.id)!.name, lat: s.lat, lon: s.lon };
}

/** Manhattan's grid makes "uptown"/"downtown" the words people use; elsewhere, name where it heads. */
function direction(from: Station, to: Station): string {
  if (from.borough === "Manhattan" && to.borough === "Manhattan" && Math.abs(to.lat - from.lat) > Math.abs(to.lon - from.lon) * 0.6) {
    return to.lat > from.lat ? "uptown" : "downtown";
  }
  return to.borough !== from.borough ? `toward ${to.borough}` : `toward ${LINES.get(to.id)!.name}`;
}

function ride(from: Station, to: Station, lines: string[]): Ride {
  const meters = haversine(from, to) * TRACK_DETOUR;
  const speed = lines.some((l) => EXPRESS_LINES.has(l)) ? EXPRESS_M_PER_MIN : LOCAL_M_PER_MIN;
  return { lines, from: label(from), to: label(to), direction: direction(from, to), minutes: Math.max(2, Math.round(meters / speed)) };
}

/**
 * The rides between two stations: one if they share a line, otherwise two via
 * the transfer station that adds the least distance. Line topology beyond
 * "these stations share a letter" is not modelled, so this can miss a better
 * route; the UI offers live directions for that.
 */
function rides(a: Station, b: Station): Ride[] | null {
  const la = LINES.get(a.id)!.lines;
  const lb = LINES.get(b.id)!.lines;
  const direct = shared(la, lb);
  if (direct.length) return [ride(a, b, direct)];
  const straight = haversine(a, b);
  let best: { via: Station; extra: number; l1: string[]; l2: string[] } | null = null;
  for (const t of STATIONS) {
    if (t.id === a.id || t.id === b.id) continue;
    const lt = LINES.get(t.id)!.lines;
    const l1 = shared(la, lt);
    const l2 = shared(lt, lb);
    if (!l1.length || !l2.length) continue;
    const extra = haversine(a, t) + haversine(t, b) - straight;
    if (!best || extra < best.extra) best = { via: t, extra, l1, l2 };
  }
  // A transfer that doubles the trip is not one anybody would take.
  if (!best || best.extra > straight * 0.8 + 1500) return null;
  return [ride(a, best.via, best.l1), ride(best.via, b, best.l2)];
}

export function subwayLeg(from: LatLon, to: LatLon): Leg | null {
  const starts = nearestStations(from, 5, 1200);
  const ends = nearestStations(to, 5, 1200);
  let best: Leg | null = null;
  for (const a of starts) {
    for (const b of ends) {
      if (a.station.id === b.station.id) continue;
      const route = rides(a.station, b.station);
      if (!route) continue;
      const walkToMin = estimateWalkMin(a.meters);
      const walkFromMin = estimateWalkMin(b.meters);
      const minutes =
        walkToMin + SUBWAY_WAIT_MIN + route.reduce((s, r) => s + r.minutes, 0) + (route.length > 1 ? TRANSFER_MIN : 0) + walkFromMin;
      if (!best || minutes < best.minutes) {
        best = {
          mode: "subway",
          minutes,
          meters: Math.round(route.reduce((s, r) => s + haversine(r.from, r.to), 0) * TRACK_DETOUR),
          estimated: true,
          board: route[0].from,
          alight: route[route.length - 1].to,
          walkToMin,
          walkFromMin,
          rides: route,
        };
      }
    }
  }
  return best;
}

const PROFILE: Record<"walk" | "bike" | "car", Profile> = { walk: "foot", bike: "bike", car: "car" };

async function routedMatrix(mode: "walk" | "bike" | "car", points: LatLon[]): Promise<{ legs: Leg[][]; routed: boolean }> {
  const table = await osrmMatrix(PROFILE[mode], points, { timeoutMs: 15_000 });
  const legs = points.map((a, i) =>
    points.map((b, j): Leg => {
      if (i === j) return { mode, minutes: 0, meters: 0, estimated: false };
      const cell = table?.[i]?.[j];
      if (!cell || cell.duration === null) return estimate(mode, haversine(a, b));
      const minutes = mode === "car" ? Math.round((cell.duration / 60) * TRAFFIC_FACTOR) + PARKING_MIN : Math.max(1, Math.round(cell.duration / 60));
      return { mode, minutes, meters: cell.distance === null ? null : Math.round(cell.distance), estimated: false };
    }),
  );
  return { legs, routed: table !== null };
}

/**
 * In "transit" mode, `walkMax` caps how long a walk may be before the subway
 * takes over, even when the train is a little slower: someone travelling with
 * older parents would rather sit for 15 minutes than walk 25.
 */
/**
 * The same points are routed again and again: the plan, then its option cards
 * and the day strip. Keep recent matrices; a routed one for a while, a
 * fallback estimate only briefly so the router gets another chance.
 */
const MATRIX_CACHE = new Map<string, { at: number; value: Promise<{ legs: Leg[][]; routed: boolean }> }>();
const ROUTED_TTL_MS = 30 * 60 * 1000;
const ESTIMATED_TTL_MS = 60 * 1000;
const MATRIX_CACHE_SIZE = 100;

export async function legMatrix(mode: TravelMode, points: LatLon[], walkMax: number | null = null): Promise<{ legs: Leg[][]; routed: boolean }> {
  // Route each distinct place once, in a canonical order, so the same set of
  // places hits the cache however it is ordered or repeated.
  const unique = [...new Map(points.map((p) => [pointKey(p), p])).entries()].sort(([a], [b]) => a.localeCompare(b));
  const at = new Map(unique.map(([k], i) => [k, i]));
  const key = `${mode}|${walkMax ?? "-"}|${unique.map(([k]) => k).join(";")}`;
  let hit = MATRIX_CACHE.get(key);
  if (!hit || Date.now() - hit.at >= ROUTED_TTL_MS) {
    const value = computeLegMatrix(mode, unique.map(([, p]) => p), walkMax);
    hit = { at: Date.now(), value };
    MATRIX_CACHE.set(key, hit);
    if (MATRIX_CACHE.size > MATRIX_CACHE_SIZE) MATRIX_CACHE.delete(MATRIX_CACHE.keys().next().value!);
    value.then(
      (m) => {
        // An estimate expires soon, so the router gets another chance.
        if (!m.routed) MATRIX_CACHE.set(key, { at: Date.now() - ROUTED_TTL_MS + ESTIMATED_TTL_MS, value });
      },
      () => MATRIX_CACHE.delete(key),
    );
  }
  const { legs, routed } = await hit.value;
  const index = points.map((p) => at.get(pointKey(p))!);
  return { legs: index.map((i) => index.map((j) => legs[i][j])), routed };
}

async function computeLegMatrix(mode: TravelMode, points: LatLon[], walkMax: number | null): Promise<{ legs: Leg[][]; routed: boolean }> {
  if (mode !== "transit") return routedMatrix(mode, points);
  const walk = await routedMatrix("walk", points);
  const legs = walk.legs.map((row, i) =>
    row.map((walkLeg, j) => {
      if (i === j) return walkLeg;
      const train = subwayLeg(points[i], points[j]);
      if (!train) return walkLeg;
      if (walkMax !== null && walkLeg.minutes > walkMax) return train;
      return train.minutes + SUBWAY_MIN_SAVING <= walkLeg.minutes ? train : walkLeg;
    }),
  );
  return { legs, routed: walk.routed };
}
