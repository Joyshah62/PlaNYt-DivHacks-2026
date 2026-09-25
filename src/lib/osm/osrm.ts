import { haversine } from "./geo";
import { USER_AGENT } from "./overpass";
import type { LatLon, RouteResult } from "./types";

/**
 * Public OSRM servers, tried in order. The OSRM project's demo only routes cars;
 * FOSSGIS hosts separate foot and car profiles. Both are free and fair-use.
 */
const SERVERS = {
  foot: [{ host: "https://routing.openstreetmap.de/routed-foot", profile: "foot" }],
  car: [
    { host: "https://router.project-osrm.org", profile: "driving" },
    { host: "https://routing.openstreetmap.de/routed-car", profile: "driving" },
  ],
} as const;

export type Profile = keyof typeof SERVERS;

/** Keep requests well under the public server's coordinate limit. */
const MAX_DESTINATIONS = 80;
const MAX_ORIGINS = 4;

export interface TableLeg {
  /** Seconds, or null when OSRM found no route. */
  duration: number | null;
  /** Meters, or null when OSRM found no route. */
  distance: number | null;
}

interface TableResponse {
  code?: string;
  durations?: (number | null)[][];
  distances?: (number | null)[][];
}

/**
 * The table has a row per origin candidate and a column per destination. Each
 * destination takes its fastest origin: an address point often sits inside a
 * block, and the closest path OSRM snaps to can be a courtyard walkway that goes
 * the long way round. Trying the few nearest paths and keeping the best is what
 * a person walking out of the building would actually do.
 */
export function parseTable(json: TableResponse, destinationCount: number): TableLeg[] | null {
  if (json.code !== "Ok" || !json.durations?.length) return null;
  const rows = json.durations;
  if (rows.some((r) => r.length !== destinationCount)) return null;

  return Array.from({ length: destinationCount }, (_, col) => {
    let best: TableLeg = { duration: null, distance: null };
    rows.forEach((row, r) => {
      const duration = row[col];
      if (duration === null || duration === undefined) return;
      if (best.duration === null || duration < best.duration) {
        best = { duration, distance: json.distances?.[r]?.[col] ?? null };
      }
    });
    return best;
  });
}

export interface TableOptions {
  /** Per-request budget. The shared servers sometimes queue for 10 s or more. */
  timeoutMs?: number;
  /** Retries after a 429; each waits ~1.2 s. */
  retries?: number;
}

/** The public server rate-limits bursts; one polite retry covers most of them. */
async function getJson<T>(url: string, { timeoutMs = 12_000, retries = 1 }: TableOptions = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (res.status === 429 && retries > 0) {
    await new Promise((r) => setTimeout(r, 1200));
    return getJson<T>(url, { timeoutMs, retries: retries - 1 });
  }
  if (!res.ok) throw new Error(`OSRM responded ${res.status}`);
  return (await res.json()) as T;
}

function coordinates(points: LatLon[]): string {
  return points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
}

const candidateCache = new Map<string, LatLon[]>();

/** The address itself plus the few distinct network points nearest to it. */
async function originCandidates(profile: Profile, origin: LatLon, options: TableOptions): Promise<LatLon[]> {
  const { host, profile: name } = SERVERS[profile][0];
  const key = `${profile}:${origin.lat.toFixed(5)},${origin.lon.toFixed(5)}`;
  const cached = candidateCache.get(key);
  if (cached) return cached;
  try {
    const json = await getJson<{ waypoints?: { location: [number, number] }[] }>(
      `${host}/nearest/v1/${name}/${coordinates([origin])}?number=10`,
      options,
    );
    const candidates: LatLon[] = [origin];
    for (const w of json.waypoints ?? []) {
      const point = { lon: w.location[0], lat: w.location[1] };
      if (haversine(origin, point) > 120) continue;
      if (candidates.some((c) => haversine(c, point) < 15)) continue;
      candidates.push(point);
      if (candidates.length === MAX_ORIGINS) break;
    }
    candidateCache.set(key, candidates);
    return candidates;
  } catch {
    return [origin];
  }
}

async function tableBatch(profile: Profile, origins: LatLon[], batch: LatLon[], options: TableOptions): Promise<TableLeg[] | null> {
  const sources = origins.map((_, i) => i).join(";");
  const destinations = batch.map((_, i) => i + origins.length).join(";");
  const path = `${coordinates([...origins, ...batch])}?sources=${sources}&destinations=${destinations}&annotations=duration,distance`;
  for (const { host, profile: name } of SERVERS[profile]) {
    try {
      const legs = parseTable(await getJson<TableResponse>(`${host}/table/v1/${name}/${path}`, options), batch.length);
      if (legs) return legs;
    } catch (error) {
      console.error("[osrm]", host, error instanceof Error ? error.message : error);
    }
  }
  return null;
}

/**
 * Route one origin to many destinations. Returns null if any batch fails, so the
 * caller can fall back to estimates for the whole set rather than mixing.
 */
export async function osrmTable(
  profile: Profile,
  origin: LatLon,
  destinations: LatLon[],
  options: TableOptions = {},
): Promise<TableLeg[] | null> {
  if (destinations.length === 0) return [];
  // Cars start from the curb, which snaps reliably; only walkers get stuck in courtyards.
  const origins = profile === "foot" ? await originCandidates(profile, origin, options) : [origin];
  const batches: LatLon[][] = [];
  for (let i = 0; i < destinations.length; i += MAX_DESTINATIONS) {
    batches.push(destinations.slice(i, i + MAX_DESTINATIONS));
  }
  const results: (TableLeg[] | null)[] = [];
  for (const b of batches) results.push(await tableBatch(profile, origins, b, options));
  if (results.some((r) => r === null)) return null;
  return results.flat() as TableLeg[];
}

export function toMinutes(seconds: number | null): number | null {
  return seconds === null ? null : Math.max(1, Math.round(seconds / 60));
}

/**
 * A drawable route from the apartment to one place. Walks start from whichever
 * nearby path gets there fastest (see parseTable), with a short connector from
 * the address itself so the line visibly leaves the building.
 */
export async function osrmRoute(profile: Profile, from: LatLon, to: LatLon): Promise<RouteResult | null> {
  let start = from;
  if (profile === "foot") {
    const origins = await originCandidates(profile, from, { timeoutMs: 5000 });
    if (origins.length > 1) {
      const { host, profile: name } = SERVERS.foot[0];
      const sources = origins.map((_, i) => i).join(";");
      try {
        const json = await getJson<TableResponse>(
          `${host}/table/v1/${name}/${coordinates([...origins, to])}?sources=${sources}&destinations=${origins.length}`,
          { timeoutMs: 5000 },
        );
        const column = json.durations?.map((row) => row[0]) ?? [];
        let best = 0;
        column.forEach((d, i) => {
          if (d !== null && d !== undefined && (column[best] == null || d < (column[best] as number))) best = i;
        });
        start = origins[best];
      } catch {
        /* fall through with the address itself */
      }
    }
  }

  for (const { host, profile: name } of SERVERS[profile]) {
    try {
      const json = await getJson<{
        code?: string;
        routes?: { duration: number; distance: number; geometry: { coordinates: [number, number][] } }[];
      }>(`${host}/route/v1/${name}/${coordinates([start, to])}?overview=full&geometries=geojson`, { timeoutMs: 8000 });
      const route = json.code === "Ok" ? json.routes?.[0] : undefined;
      if (!route) continue;
      const coords = route.geometry.coordinates;
      if (start !== from) coords.unshift([from.lon, from.lat]);
      return { coordinates: coords, minutes: toMinutes(route.duration) ?? 1, meters: Math.round(route.distance) };
    } catch (error) {
      console.error("[osrm route]", host, error instanceof Error ? error.message : error);
    }
  }
  return null;
}
