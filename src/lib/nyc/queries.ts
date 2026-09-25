import { complaintCaseExpression, violationCaseExpression } from "./classify";
import {
  DATASETS,
  rawQueryUrl,
  runQuery,
  type QueryResult,
} from "./socrata";
import type { IssueCategory, ViolationClass } from "./types";

/** How far back the issue breakdown and recurrence windows look. */
export const ISSUE_WINDOW_YEARS = 10;
/** Cap on raw violation rows we ever pull, per list. */
export const VIOLATION_SAMPLE_LIMIT = 12;

export interface PlutoRow {
  address?: string;
  yearbuilt?: string;
  numfloors?: string;
  unitsres?: string;
  unitstotal?: string;
  zipcode?: string;
}

export interface ClassCountRow {
  class?: string;
  st?: string;
  n?: string;
}

export interface CategoryYearRow {
  cat?: string;
  yr?: string;
  st?: string;
  n?: string;
}

export interface ViolationRow {
  violationid?: string;
  class?: string;
  novdescription?: string;
  inspectiondate?: string;
  violationstatus?: string;
  currentstatus?: string;
}

const VIOLATION_FIELDS =
  "violationid, class, novdescription, inspectiondate, violationstatus, currentstatus";

export function plutoParams(bbl: string) {
  return {
    bbl: String(Number.parseInt(bbl, 10)),
    $select: "address,yearbuilt,numfloors,unitsres,unitstotal,zipcode",
    $limit: "1",
  };
}

export function fetchBuilding(bbl: string): Promise<QueryResult<PlutoRow>> {
  return runQuery(
    "building",
    DATASETS.pluto,
    plutoParams(bbl),
    "Current PLUTO tax-lot record",
  );
}

export function violationClassParams(bin: string) {
  return {
    $select: "class, violationstatus as st, count(1) as n",
    $where: `bin='${bin}'`,
    $group: "class, st",
    $limit: "50",
  };
}

export function fetchViolationClassCounts(
  bin: string,
): Promise<QueryResult<ClassCountRow>> {
  return runQuery(
    "violationClasses",
    DATASETS.violations,
    violationClassParams(bin),
    "All violations on record for this building",
  );
}

export function violationCategoryParams(bin: string) {
  return {
    $select: `${violationCaseExpression()} as cat, date_trunc_y(inspectiondate) as yr, violationstatus as st, count(1) as n`,
    $where: `bin='${bin}'`,
    $group: "cat, yr, st",
    $limit: "1000",
  };
}

/**
 * Classification runs inside Socrata. Some buildings carry more than 5,000
 * violations; this returns roughly 150 aggregate rows instead.
 */
export function fetchViolationsByCategory(
  bin: string,
): Promise<QueryResult<CategoryYearRow>> {
  return runQuery(
    "violationCategories",
    DATASETS.violations,
    violationCategoryParams(bin),
    "All violations on record for this building",
  );
}

export function problemCategoryParams(bin: string) {
  return {
    $select: `${complaintCaseExpression()} as cat, date_trunc_y(received_date) as yr, count(1) as n`,
    $where: `bin='${bin}'`,
    $group: "cat, yr",
    $limit: "1000",
  };
}

export function fetchProblemsByCategory(
  bin: string,
): Promise<QueryResult<CategoryYearRow>> {
  return runQuery(
    "problemCategories",
    DATASETS.complaints,
    problemCategoryParams(bin),
    "All reported problems on record for this building",
  );
}

export function recentProblemsParams(bin: string, since: Date) {
  return {
    $select: "count(1) as n",
    $where: `bin='${bin}' AND received_date > '${since.toISOString().slice(0, 19)}'`,
  };
}

export function fetchProblemsLast12Months(
  bin: string,
  now = new Date(),
): Promise<QueryResult<{ n?: string }>> {
  const since = new Date(now);
  since.setFullYear(since.getFullYear() - 1);
  const format = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return runQuery(
    "problemsRecent",
    DATASETS.complaints,
    recentProblemsParams(bin, since),
    `${format(since)} – ${format(now)}`,
  );
}

export function openViolationParams(bin: string, limit = VIOLATION_SAMPLE_LIMIT) {
  return {
    $select: VIOLATION_FIELDS,
    $where: `bin='${bin}' AND violationstatus='Open'`,
    $order: "inspectiondate DESC",
    $limit: String(limit),
  };
}

/** The only place we pull raw rows, and it is capped. */
export function fetchOpenViolations(
  bin: string,
): Promise<QueryResult<ViolationRow>> {
  return runQuery(
    "openViolations",
    DATASETS.violations,
    openViolationParams(bin),
    "Violations currently listed as open",
  );
}

export function seriousOpenViolationParams(
  bin: string,
  limit = VIOLATION_SAMPLE_LIMIT,
) {
  return {
    $select: VIOLATION_FIELDS,
    $where: `bin='${bin}' AND violationstatus='Open' AND class in('B','C')`,
    $order: "class DESC, inspectiondate DESC",
    $limit: String(limit),
  };
}

/**
 * A severity-filtered companion to the list above. The twelve most recent open
 * violations are frequently all Class A, which cannot evidence a Class B or C
 * finding - this query guarantees the serious ones are available to cite.
 */
export function fetchSeriousOpenViolations(
  bin: string,
): Promise<QueryResult<ViolationRow>> {
  return runQuery(
    "seriousOpenViolations",
    DATASETS.violations,
    seriousOpenViolationParams(bin),
    "Class B and C violations currently listed as open",
  );
}

export function violationsSourceUrl(bin: string) {
  return rawQueryUrl(DATASETS.violations, openViolationParams(bin));
}

export function problemsSourceUrl(bin: string) {
  return rawQueryUrl(DATASETS.complaints, problemCategoryParams(bin));
}

export function seriousViolationsSourceUrl(bin: string) {
  return rawQueryUrl(DATASETS.violations, seriousOpenViolationParams(bin));
}

export function parseCategoryYearRows(rows: CategoryYearRow[]) {
  return rows.map((row) => ({
    category: (row.cat ?? "Other") as IssueCategory,
    year: row.yr ? Number.parseInt(row.yr.slice(0, 4), 10) : null,
    status: row.st ?? null,
    count: Number.parseInt(row.n ?? "0", 10) || 0,
  }));
}

export function parseClassCounts(rows: ClassCountRow[]) {
  return rows.map((row) => ({
    class: (row.class ?? "A").toUpperCase() as ViolationClass,
    open: (row.st ?? "").toLowerCase() === "open",
    count: Number.parseInt(row.n ?? "0", 10) || 0,
  }));
}
