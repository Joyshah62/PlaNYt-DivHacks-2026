/**
 * The normalized report the frontend consumes.
 *
 * Terminology note that runs through this whole file: the HPD Complaint Problems
 * dataset has one row per *problem* recorded against a complaint. One complaint
 * can carry several problem rows, and one resident can file repeatedly. So a row
 * count is a count of reported problems - never of complaints, residents, or
 * incidents - and the UI must say "reported problems" wherever it shows one.
 */

export type IssueCategory =
  | "Heating"
  | "Hot Water"
  | "Pests"
  | "Mold"
  | "Leaks"
  | "Electrical"
  | "Other";

export type ViolationClass = "A" | "B" | "C" | "I";

/** Every upstream request we make, tracked individually. */
export type QueryName =
  | "building"
  | "violationClasses"
  | "violationCategories"
  | "problemCategories"
  | "problemsRecent"
  | "openViolations"
  | "seriousOpenViolations";

/**
 * A failed query and a query that legitimately returned nothing are different
 * facts about a building, and conflating them is how a tool ends up implying a
 * building is clean when a dataset was simply down.
 */
export interface QueryStatus {
  name: QueryName;
  /** The request completed. False means we do not know anything from this source. */
  ok: boolean;
  /** Completed successfully and returned no rows. Only meaningful when ok. */
  empty: boolean;
  /** What span of records this query looked at, for display next to empty results. */
  coveredPeriod: string;
  retrievedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

export interface BuildingInfo {
  address: string;
  borough: string;
  zip: string | null;
  yearBuilt: number | null;
  floors: number | null;
  units: number | null;
  bbl: string;
  bin: string;
  /** Null only if GeoSearch returned no geometry; neighborhood sections then stay hidden. */
  location: { lat: number; lon: number } | null;
}

export interface Snapshot {
  openClassA: number | null;
  openClassB: number | null;
  openClassC: number | null;
  totalOpenViolations: number | null;
  reportedProblemsLast12Months: number | null;
  mostReportedIssue: IssueCategory | null;
}

export interface YearCount {
  year: number;
  count: number;
}

export interface IssueSummary {
  name: IssueCategory;
  reportedProblems: number;
  violations: number;
  byYear: YearCount[];
  /** Completed years in the recent window that carry at least one report. */
  recentYears: number[];
  /** Reports in at least two of the last three completed years. */
  repeatedRecently: boolean;
  /** Repetition that sits outside the recent window - context, not a current claim. */
  historicalYears: number[];
}

export interface TrendPoint extends YearCount {
  /** The in-progress year is never compared against complete ones. */
  partial: boolean;
}

export interface TrendAnalysis {
  points: TrendPoint[];
  /** The two most recent completed calendar years. */
  comparison: { earlier: YearCount; later: YearCount } | null;
  yearToDate: YearCount | null;
  /** Below the volume floor this stays null and the UI states counts instead. */
  direction: "increased" | "decreased" | "unchanged" | null;
  sentence: string;
}

export interface RecentViolation {
  id: string;
  class: ViolationClass;
  category: IssueCategory;
  reportedOn: string | null;
  /** HPD's own status wording, shown as-is. */
  status: string;
  description: string;
}

export interface EvidenceLink {
  label: string;
  url: string;
  /** Raw data links are labelled so nobody expects a friendly page. */
  raw: boolean;
}

export interface EvidenceItem {
  label: string;
  value: string;
  detail: string | null;
}

export interface Evidence {
  items: EvidenceItem[];
  records: RecentViolation[];
  /** Set when `records` is a capped sample rather than the full set. */
  recordsCappedFrom: number | null;
  links: EvidenceLink[];
}

export interface Insight {
  /** Stable across reloads so checklist items can reference it. */
  id: string;
  priority: number;
  title: string;
  /** What the records show. */
  finding: string;
  /** The limited conclusion those records support - never a verdict. */
  interpretation: string;
  /** A question to ask or something to look at during the viewing. */
  nextStep: string;
  coveredPeriod: string;
  evidence: Evidence;
  checklistItemIds: string[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  kind: "question" | "observation";
  insightId: string | null;
}

export interface BuildingReport {
  building: BuildingInfo;
  snapshot: Snapshot;
  insights: Insight[];
  /** Suggested starting points; the reader edits their own copy. */
  checklist: ChecklistItem[];
  issues: IssueSummary[];
  trend: TrendAnalysis;
  openViolations: RecentViolation[];
  openViolationsCappedFrom: number | null;
  /** Shown when a query failed, naming what could not be assessed. */
  notAssessed: string[];
  queries: QueryStatus[];
  generatedAt: string;
}
