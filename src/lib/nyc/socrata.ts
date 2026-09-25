import type { QueryName, QueryStatus } from "./types";

const BASE = "https://data.cityofnewyork.us/resource";

export const DATASETS = {
  violations: "wvxf-dwi5",
  complaints: "ygpa-z7cr",
  pluto: "64uk-42ks",
} as const;

/** Official, human-browsable landing pages for each dataset. */
export const DATASET_PAGES = {
  violations: `https://data.cityofnewyork.us/d/${DATASETS.violations}`,
  complaints: `https://data.cityofnewyork.us/d/${DATASETS.complaints}`,
  pluto: `https://data.cityofnewyork.us/d/${DATASETS.pluto}`,
} as const;

/** The exact filtered query behind a number, so a reader can check it. */
export function rawQueryUrl(
  dataset: string,
  params: Record<string, string>,
): string {
  return `${BASE}/${dataset}.json?${new URLSearchParams(params)}`;
}

export interface QueryResult<T> {
  rows: T[];
  status: QueryStatus;
}

/**
 * One request to NYC Open Data, reported as a result rather than an exception.
 * The distinction the caller needs is three-way - succeeded with rows, succeeded
 * with none, or failed - and a thrown error collapses the last two.
 */
export async function runQuery<T>(
  name: QueryName,
  dataset: string,
  params: Record<string, string>,
  coveredPeriod: string,
  timeoutMs = 12000,
): Promise<QueryResult<T>> {
  const started = Date.now();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.NYC_APP_TOKEN) {
    headers["X-App-Token"] = process.env.NYC_APP_TOKEN;
  }

  try {
    const res = await fetch(`${BASE}/${dataset}.json?${new URLSearchParams(params)}`, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`${dataset} responded ${res.status}`);
    }

    const rows = (await res.json()) as T[];
    return {
      rows,
      status: {
        name,
        ok: true,
        empty: rows.length === 0,
        coveredPeriod,
        retrievedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        error: null,
      },
    };
  } catch (error) {
    console.error(`[socrata] ${name} failed:`, error);
    return {
      rows: [],
      status: {
        name,
        ok: false,
        empty: false,
        coveredPeriod,
        retrievedAt: null,
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

/** Socrata returns every value as a string, including counts. */
export function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** `date_trunc_y` gives back a full timestamp; we only ever want the year. */
export function yearOf(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const year = Number.parseInt(timestamp.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}
