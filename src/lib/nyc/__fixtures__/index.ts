import type { QueryResult } from "../socrata";
import type { CategoryYearRow, ClassCountRow, PlutoRow, ViolationRow } from "../queries";
import type { QueryName, QueryStatus } from "../types";
import type { ResolvedAddress } from "../geosearch";
import type { AnalyzeInputs } from "../analyze";

/** Fixed clock so year-relative logic is deterministic. "Now" is mid-2026. */
export const NOW = new Date("2026-06-15T12:00:00.000Z");

export const ADDRESS: ResolvedAddress = {
  label: "765 LINCOLN AVENUE",
  houseNumber: "765",
  street: "LINCOLN AVENUE",
  borough: "Brooklyn",
  zip: "11208",
  bbl: "3042710001",
  bin: "3343260",
  lat: 40.669958,
  lon: -73.864809,
};

export function ok<T>(name: QueryName, rows: T[]): QueryResult<T> {
  return {
    rows,
    status: {
      name,
      ok: true,
      empty: rows.length === 0,
      coveredPeriod: "test period",
      retrievedAt: NOW.toISOString(),
      durationMs: 10,
      error: null,
    } satisfies QueryStatus,
  };
}

/** A query that succeeded and genuinely found nothing. */
export function empty<T>(name: QueryName): QueryResult<T> {
  return ok<T>(name, []);
}

/** A query that failed - we know nothing, which is not the same as nothing. */
export function failed<T>(name: QueryName): QueryResult<T> {
  return {
    rows: [],
    status: {
      name,
      ok: false,
      empty: false,
      coveredPeriod: "test period",
      retrievedAt: null,
      durationMs: 12000,
      error: "timeout",
    } satisfies QueryStatus,
  };
}

export function problemRow(
  cat: string,
  year: number,
  n: number,
): CategoryYearRow {
  return { cat, yr: `${year}-01-01T00:00:00.000`, n: String(n) };
}

export function classRow(
  cls: string,
  status: "Open" | "Close",
  n: number,
): ClassCountRow {
  return { class: cls, st: status, n: String(n) };
}

export function violationRow(
  id: string,
  cls: string,
  description: string,
  date = "2026-05-01T00:00:00.000",
): ViolationRow {
  return {
    violationid: id,
    class: cls,
    novdescription: description,
    inspectiondate: date,
    violationstatus: "Open",
    currentstatus: "NOV SENT OUT",
  };
}

export const PLUTO: PlutoRow = {
  address: "LINCOLN AVENUE",
  yearbuilt: "1926",
  numfloors: "4",
  unitsres: "48",
  unitstotal: "48",
  zipcode: "11208",
};

/** A complete, healthy input set that individual tests override piecemeal. */
export function inputs(overrides: Partial<AnalyzeInputs> = {}): AnalyzeInputs {
  return {
    address: ADDRESS,
    now: NOW,
    building: ok("building", [PLUTO]),
    violationClasses: ok("violationClasses", []),
    violationCategories: ok("violationCategories", []),
    problemCategories: ok("problemCategories", []),
    problemsRecent: ok("problemsRecent", [{ n: "0" }]),
    openViolations: ok("openViolations", []),
    seriousOpenViolations: ok("seriousOpenViolations", []),
    ...overrides,
  };
}
