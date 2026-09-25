import type { OverpassElement } from "./categories";
import type { LatLon, SourceStatus } from "./types";

/** Public instances, most reliable first. Mirrors come and go; the hedge below tolerates that. */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export const USER_AGENT = "RentCheckNYC/0.1 (hackathon project; apartment research tool)";

export const RADIUS_METERS = 1200;

export function buildQuery({ lat, lon }: LatLon, radius = RADIUS_METERS): string {
  const around = `(around:${radius},${lat},${lon})`;
  return `[out:json][timeout:25];
(
  nwr${around}[amenity~"^(restaurant|fast_food|cafe|bar|pub|nightclub|pharmacy|hospital|clinic|cinema|theatre)$"];
  nwr${around}[shop~"^(supermarket|grocery|greengrocer|convenience|laundry)$"];
  nwr${around}[leisure~"^(park|playground|fitness_centre|sports_centre)$"];
  nwr${around}[tourism=museum];
  nwr${around}[railway=station];
  node${around}[highway=bus_stop];
);
out center tags;`;
}

export interface OverpassResult {
  elements: OverpassElement[];
  status: SourceStatus;
}

/** How long to wait on one mirror before also asking the next. */
const HEDGE_AFTER_MS = 5000;
const TOTAL_BUDGET_MS = 20_000;

async function ask(endpoint: string, body: URLSearchParams, signal: AbortSignal): Promise<OverpassElement[]> {
  const res = await fetch(endpoint, {
    method: "POST",
    body,
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${new URL(endpoint).host} responded ${res.status}`);
  const json = (await res.json()) as { elements?: OverpassElement[] };
  return json.elements ?? [];
}

/**
 * The public Overpass servers are shared and often busy. Ask the first mirror;
 * if it hasn't answered in a few seconds (or fails), ask the next as well, and
 * take whichever succeeds first. Never throws - a failure is a status, not an
 * empty neighborhood.
 */
export async function fetchNearbyElements(center: LatLon): Promise<OverpassResult> {
  const body = new URLSearchParams({ data: buildQuery(center) });
  const controllers = ENDPOINTS.map(() => new AbortController());
  const deadline = setTimeout(() => controllers.forEach((c) => c.abort()), TOTAL_BUDGET_MS);
  const errors: string[] = [];

  try {
    const elements = await new Promise<OverpassElement[]>((resolve, reject) => {
      let started = 0;
      let settled = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const launch = () => {
        clearTimeout(timer);
        if (started >= ENDPOINTS.length) return;
        const i = started++;
        ask(ENDPOINTS[i], body, controllers[i].signal).then(
          (els) => {
            controllers.forEach((c, j) => j !== i && c.abort());
            resolve(els);
          },
          (error) => {
            errors.push(error instanceof Error ? error.message : String(error));
            if (++settled === ENDPOINTS.length) reject(new Error(errors.join("; ")));
            else launch(); // failed fast: don't wait out the hedge delay
          },
        );
        if (started < ENDPOINTS.length) timer = setTimeout(launch, HEDGE_AFTER_MS);
      };
      launch();
    });

    return {
      elements,
      status: { ok: true, source: "OpenStreetMap via Overpass", retrievedAt: new Date().toISOString(), error: null },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[overpass]", message);
    return {
      elements: [],
      status: { ok: false, source: "OpenStreetMap via Overpass", retrievedAt: null, error: message },
    };
  } finally {
    clearTimeout(deadline);
  }
}
