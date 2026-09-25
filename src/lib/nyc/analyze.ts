import type { ResolvedAddress } from "./geosearch";
import {
  ISSUE_WINDOW_YEARS,
  parseCategoryYearRows,
  parseClassCounts,
  problemsSourceUrl,
  seriousViolationsSourceUrl,
  violationsSourceUrl,
  type CategoryYearRow,
  type ClassCountRow,
  type PlutoRow,
  type ViolationRow,
} from "./queries";
import { classifyViolation } from "./classify";
import { DATASET_PAGES, num, type QueryResult } from "./socrata";
import type {
  BuildingReport,
  ChecklistItem,
  Evidence,
  Insight,
  IssueCategory,
  IssueSummary,
  QueryStatus,
  RecentViolation,
  Snapshot,
  TrendAnalysis,
  TrendPoint,
  ViolationClass,
  YearCount,
} from "./types";

/** Reports in at least this many of the last three completed years. */
const RECENT_REPEAT_MIN_YEARS = 2;
const RECENT_COMPLETED_YEARS = 3;
/** At or below this many reports, directional trend language is not justified. */
const LOW_VOLUME_THRESHOLD = 3;
const TREND_YEARS = 6;
const MAX_INSIGHTS = 3;
const MAX_CHECKLIST_ITEMS = 5;
/** Supporting records cited inside a single insight. */
const EVIDENCE_RECORD_LIMIT = 4;

export const CLASS_LABELS: Record<ViolationClass, string> = {
  A: "Non-hazardous",
  B: "Hazardous",
  C: "Immediately hazardous",
  I: "Informational",
};

export interface AnalyzeInputs {
  address: ResolvedAddress;
  now: Date;
  building: QueryResult<PlutoRow>;
  violationClasses: QueryResult<ClassCountRow>;
  violationCategories: QueryResult<CategoryYearRow>;
  problemCategories: QueryResult<CategoryYearRow>;
  problemsRecent: QueryResult<{ n?: string }>;
  openViolations: QueryResult<ViolationRow>;
  seriousOpenViolations: QueryResult<ViolationRow>;
}

/* ------------------------------------------------------------------ helpers */

function plural(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function listYears(years: number[]): string {
  if (years.length === 0) return "";
  if (years.length === 1) return String(years[0]);
  return `${years.slice(0, -1).join(", ")} and ${years[years.length - 1]}`;
}

/**
 * NYC datasets store addresses in caps ("765 LINCOLN AVENUE"), which reads as
 * shouting. Ordinals and directional initials need care: "E 14TH ST" should
 * become "E 14th St", not "E 14Th St".
 */
export function titleCaseAddress(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (/^\d+(st|nd|rd|th)$/.test(word)) return word;
      if (/^[nsew]$/.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function positive(value: string | undefined): number | null {
  const n = num(value);
  return n > 0 ? Math.round(n) : null;
}

/** The last three *completed* calendar years, oldest first. */
export function recentCompletedYears(now: Date): number[] {
  const current = now.getFullYear();
  return Array.from(
    { length: RECENT_COMPLETED_YEARS },
    (_, i) => current - RECENT_COMPLETED_YEARS + i,
  );
}

/** Those three years plus the year in progress - used for "most reported". */
function reportingWindow(now: Date): number[] {
  return [...recentCompletedYears(now), now.getFullYear()];
}

function periodLabel(years: number[]): string {
  return `${years[0]}–${years[years.length - 1]}`;
}

/* -------------------------------------------------------------------- trend */

export function buildTrend(
  rows: CategoryYearRow[],
  available: boolean,
  now: Date,
): TrendAnalysis {
  const currentYear = now.getFullYear();
  const totals = new Map<number, number>();
  for (const row of parseCategoryYearRows(rows)) {
    if (row.year === null) continue;
    totals.set(row.year, (totals.get(row.year) ?? 0) + row.count);
  }

  const points: TrendPoint[] = [];
  for (let year = currentYear - TREND_YEARS + 1; year <= currentYear; year++) {
    points.push({
      year,
      count: totals.get(year) ?? 0,
      partial: year === currentYear,
    });
  }

  if (!available) {
    return {
      points: [],
      comparison: null,
      yearToDate: null,
      direction: null,
      sentence:
        "Reported problem records are unavailable, so we cannot describe how reports have changed.",
    };
  }

  const earlier: YearCount = {
    year: currentYear - 2,
    count: totals.get(currentYear - 2) ?? 0,
  };
  const later: YearCount = {
    year: currentYear - 1,
    count: totals.get(currentYear - 1) ?? 0,
  };
  const yearToDate: YearCount = {
    year: currentYear,
    count: totals.get(currentYear) ?? 0,
  };

  // Only completed years are compared. The year in progress is reported on its
  // own, because measuring a partial year against a full one invents a decline.
  const comparisonTotal = earlier.count + later.count;
  let direction: TrendAnalysis["direction"] = null;
  let sentence: string;

  if (comparisonTotal <= LOW_VOLUME_THRESHOLD) {
    sentence =
      comparisonTotal === 0
        ? `No problems were reported in ${earlier.year} or ${later.year}.`
        : `Residents reported ${plural(earlier.count, "problem")} in ${earlier.year} and ${later.count.toLocaleString()} in ${later.year}.`;
  } else if (later.count > earlier.count) {
    direction = "increased";
    sentence = `Reported problems rose from ${earlier.count.toLocaleString()} in ${earlier.year} to ${later.count.toLocaleString()} in ${later.year}.`;
  } else if (later.count < earlier.count) {
    direction = "decreased";
    sentence = `Reported problems fell from ${earlier.count.toLocaleString()} in ${earlier.year} to ${later.count.toLocaleString()} in ${later.year}.`;
  } else {
    direction = "unchanged";
    sentence = `Reported problems were unchanged between ${earlier.year} and ${later.year}, at ${later.count.toLocaleString()} each year.`;
  }

  sentence += ` So far in ${yearToDate.year}, ${plural(yearToDate.count, "problem")} ${yearToDate.count === 1 ? "has" : "have"} been reported; that year is still in progress.`;

  return { points, comparison: { earlier, later }, yearToDate, direction, sentence };
}

/* ------------------------------------------------------------------- issues */

export function buildIssues(
  problemRows: CategoryYearRow[],
  violationRows: CategoryYearRow[],
  now: Date,
): IssueSummary[] {
  const currentYear = now.getFullYear();
  const since = currentYear - ISSUE_WINDOW_YEARS + 1;
  const recentWindow = recentCompletedYears(now);

  const byCategory = new Map<IssueCategory, IssueSummary>();
  const perYear = new Map<IssueCategory, Map<number, number>>();

  const touch = (category: IssueCategory): IssueSummary => {
    let entry = byCategory.get(category);
    if (!entry) {
      entry = {
        name: category,
        reportedProblems: 0,
        violations: 0,
        byYear: [],
        recentYears: [],
        repeatedRecently: false,
        historicalYears: [],
      };
      byCategory.set(category, entry);
    }
    return entry;
  };

  for (const row of parseCategoryYearRows(problemRows)) {
    if (row.year === null || row.year < since) continue;
    touch(row.category).reportedProblems += row.count;
    const years = perYear.get(row.category) ?? new Map<number, number>();
    years.set(row.year, (years.get(row.year) ?? 0) + row.count);
    perYear.set(row.category, years);
  }

  for (const row of parseCategoryYearRows(violationRows)) {
    if (row.year === null || row.year < since) continue;
    touch(row.category).violations += row.count;
  }

  for (const [category, years] of perYear) {
    const entry = byCategory.get(category)!;
    entry.byYear = [...years.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year);

    const reported = entry.byYear.filter((p) => p.count > 0).map((p) => p.year);
    entry.recentYears = reported.filter((y) => recentWindow.includes(y));
    // Recent repetition and old repetition are different claims. A building that
    // had heating trouble in 2017-2019 and none since is history, not a pattern.
    entry.repeatedRecently = entry.recentYears.length >= RECENT_REPEAT_MIN_YEARS;
    entry.historicalYears = reported.filter((y) => y < recentWindow[0]);
  }

  return [...byCategory.values()].filter(
    (i) => i.reportedProblems + i.violations > 0,
  );
}

/** Reported problems per category over the last three completed years plus this one. */
function windowTotals(
  issues: IssueSummary[],
  now: Date,
): Map<IssueCategory, number> {
  const window = reportingWindow(now);
  const totals = new Map<IssueCategory, number>();
  for (const issue of issues) {
    if (issue.name === "Other") continue;
    const total = issue.byYear
      .filter((p) => window.includes(p.year))
      .reduce((sum, p) => sum + p.count, 0);
    if (total > 0) totals.set(issue.name, total);
  }
  return totals;
}

/** Rank by volume, then alphabetically, so ordering never shifts between loads. */
function rankCategories(totals: Map<IssueCategory, number>): IssueCategory[] {
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category]) => category);
}

/* --------------------------------------------------------------- violations */

function toRecentViolations(rows: ViolationRow[]): RecentViolation[] {
  return rows.map((row, i) => ({
    id: row.violationid ?? `violation-${i}`,
    class: (row.class ?? "A").toUpperCase() as ViolationClass,
    category: classifyViolation(row.novdescription),
    reportedOn: row.inspectiondate ?? null,
    status: row.currentstatus ?? row.violationstatus ?? "Open",
    description: (row.novdescription ?? "").trim(),
  }));
}

/* ------------------------------------------------------------------ report */

export function buildReport(input: AnalyzeInputs): BuildingReport {
  const { now } = input;
  const queries: QueryStatus[] = [
    input.building.status,
    input.violationClasses.status,
    input.violationCategories.status,
    input.problemCategories.status,
    input.problemsRecent.status,
    input.openViolations.status,
    input.seriousOpenViolations.status,
  ];

  const violationsAvailable = input.violationClasses.status.ok;
  const problemsAvailable = input.problemCategories.status.ok;

  const pluto = input.building.rows[0] ?? null;
  const building = {
    // PLUTO frequently stores a bare street name; GeoSearch carries the number.
    address: titleCaseAddress(
      input.address.label || pluto?.address?.trim() || "",
    ),
    borough: input.address.borough,
    zip: input.address.zip ?? pluto?.zipcode ?? null,
    yearBuilt: positive(pluto?.yearbuilt),
    floors: positive(pluto?.numfloors),
    units: positive(pluto?.unitstotal) ?? positive(pluto?.unitsres),
    bbl: input.address.bbl,
    bin: input.address.bin,
    location:
      input.address.lat !== null && input.address.lon !== null
        ? { lat: input.address.lat, lon: input.address.lon }
        : null,
  };

  const classCounts = parseClassCounts(input.violationClasses.rows);
  const openCount = (cls: ViolationClass): number | null => {
    if (!violationsAvailable) return null;
    return classCounts
      .filter((c) => c.class === cls && c.open)
      .reduce((sum, c) => sum + c.count, 0);
  };

  const openClassA = openCount("A");
  const openClassB = openCount("B");
  const openClassC = openCount("C");

  const issues = buildIssues(
    input.problemCategories.rows,
    input.violationCategories.rows,
    now,
  );
  const trend = buildTrend(input.problemCategories.rows, problemsAvailable, now);
  const totals = windowTotals(issues, now);

  const snapshot: Snapshot = {
    openClassA,
    openClassB,
    openClassC,
    totalOpenViolations:
      openClassA === null || openClassB === null || openClassC === null
        ? null
        : openClassA + openClassB + openClassC,
    reportedProblemsLast12Months: input.problemsRecent.status.ok
      ? num(input.problemsRecent.rows[0]?.n)
      : null,
    mostReportedIssue: problemsAvailable ? (rankCategories(totals)[0] ?? null) : null,
  };

  const openViolations = toRecentViolations(input.openViolations.rows);
  const seriousViolations = toRecentViolations(input.seriousOpenViolations.rows);

  const { insights, checklist } = buildInsights({
    building,
    issues,
    totals,
    snapshot,
    openViolations,
    seriousViolations,
    problemsAvailable,
    violationsAvailable,
    now,
  });

  return {
    building,
    snapshot,
    insights,
    checklist,
    issues: issues.sort(
      (a, b) =>
        (totals.get(b.name) ?? 0) - (totals.get(a.name) ?? 0) ||
        b.reportedProblems + b.violations - (a.reportedProblems + a.violations),
    ),
    trend,
    openViolations,
    openViolationsCappedFrom:
      snapshot.totalOpenViolations !== null &&
      snapshot.totalOpenViolations > openViolations.length
        ? snapshot.totalOpenViolations
        : null,
    notAssessed: describeGaps(queries),
    queries,
    generatedAt: now.toISOString(),
  };
}

/** Names what a failed query means we cannot say, rather than staying silent. */
function describeGaps(queries: QueryStatus[]): string[] {
  const failed = new Set(queries.filter((q) => !q.ok).map((q) => q.name));
  const gaps: string[] = [];

  if (failed.has("violationClasses") || failed.has("violationCategories")) {
    gaps.push(
      "Violation records could not be retrieved, so we cannot tell you whether this building has violations listed as open.",
    );
  }
  if (failed.has("problemCategories")) {
    gaps.push(
      "Reported problem records could not be retrieved, so we cannot tell you what residents have reported or whether issues repeat.",
    );
  } else if (failed.has("problemsRecent")) {
    gaps.push(
      "The count of problems reported in the past 12 months could not be retrieved.",
    );
  }
  if (failed.has("building")) {
    gaps.push(
      "Building details such as year built and unit count could not be retrieved.",
    );
  }
  if (failed.has("openViolations") && failed.has("seriousOpenViolations")) {
    gaps.push("Individual violation records could not be retrieved.");
  }
  return gaps;
}

/* ---------------------------------------------------------------- insights */

interface InsightInputs {
  building: BuildingReport["building"];
  issues: IssueSummary[];
  totals: Map<IssueCategory, number>;
  snapshot: Snapshot;
  openViolations: RecentViolation[];
  seriousViolations: RecentViolation[];
  problemsAvailable: boolean;
  violationsAvailable: boolean;
  now: Date;
}

const CATEGORY_QUESTIONS: Record<
  IssueCategory,
  { text: string; kind: ChecklistItem["kind"] }[]
> = {
  Heating: [
    { text: "What heating repairs have been made, and when?", kind: "question" },
    {
      text: "Were there heat interruptions last winter, and how long did they last?",
      kind: "question",
    },
    { text: "Check that every radiator in the apartment works.", kind: "observation" },
  ],
  "Hot Water": [
    { text: "Has hot water been interrupted in the past year?", kind: "question" },
    { text: "Run the hot tap and time how long it takes to heat.", kind: "observation" },
  ],
  Pests: [
    {
      text: "Is there a pest control contract, and how often does it visit?",
      kind: "question",
    },
    {
      text: "Look under the sink and along kitchen baseboards for droppings or bait traps.",
      kind: "observation",
    },
  ],
  Mold: [
    { text: "Where was mold found, and what was done about it?", kind: "question" },
    {
      text: "Check bathroom ceilings, window frames, and closet corners for staining.",
      kind: "observation",
    },
  ],
  Leaks: [
    {
      text: "Was the source of past leaks fixed, or only the damage repaired?",
      kind: "question",
    },
    {
      text: "Look for water staining on ceilings and around windows.",
      kind: "observation",
    },
  ],
  Electrical: [
    { text: "Has the wiring been updated, and when?", kind: "question" },
    { text: "Test light switches and outlets in each room.", kind: "observation" },
  ],
  Other: [],
};

const GENERAL_CHECKLIST: { text: string; kind: ChecklistItem["kind"] }[] = [
  { text: "What repairs have been made in this apartment in the past two years?", kind: "question" },
  { text: "How do I report a repair, and what is the usual response time?", kind: "question" },
  { text: "Run every tap and flush the toilet; check water pressure and drainage.", kind: "observation" },
  { text: "Check that windows open, close, and lock.", kind: "observation" },
  { text: "Look for water staining on ceilings and under sinks.", kind: "observation" },
];

function evidenceFor(
  items: Evidence["items"],
  records: RecentViolation[],
  cappedFrom: number | null,
  links: Evidence["links"],
): Evidence {
  return { items, records: records.slice(0, EVIDENCE_RECORD_LIMIT), recordsCappedFrom: cappedFrom, links };
}

function buildInsights(input: InsightInputs): {
  insights: Insight[];
  checklist: ChecklistItem[];
} {
  const { snapshot, issues, totals, now, building } = input;
  const insights: Insight[] = [];
  const covered = periodLabel(reportingWindow(now));
  const represented = new Set<IssueCategory>();

  const classEvidence = (cls: "B" | "C", count: number): Evidence => {
    const records = input.seriousViolations.filter((v) => v.class === cls);
    const fallback = input.openViolations.filter((v) => v.class === cls);
    const chosen = records.length > 0 ? records : fallback;
    return evidenceFor(
      [
        {
          label: `Class ${cls} violations listed as open`,
          value: count.toLocaleString(),
          detail: CLASS_LABELS[cls],
        },
      ],
      chosen,
      count > Math.min(chosen.length, EVIDENCE_RECORD_LIMIT) ? count : null,
      [
        { label: "HPD violations dataset", url: DATASET_PAGES.violations, raw: false },
        {
          label: `Open Class B and C records for BIN ${building.bin}`,
          url: seriousViolationsSourceUrl(building.bin),
          raw: true,
        },
      ],
    );
  };

  // 1. Class C listed as open.
  if (snapshot.openClassC !== null && snapshot.openClassC > 0) {
    insights.push({
      id: "open-class-c",
      priority: insights.length + 1,
      title: "Ask what is being done about the Class C violations",
      finding: `City records list ${plural(snapshot.openClassC, "Class C violation")} as open at this building.`,
      interpretation:
        "Class C is HPD's most serious category, meaning immediately hazardous. A violation listed as open has not been recorded as corrected; it does not confirm the condition exists today, and it may be in a different apartment.",
      nextStep:
        "Ask which conditions these cover, whether any are in this apartment, and what the repair schedule is.",
      coveredPeriod: "Violations currently listed as open",
      evidence: classEvidence("C", snapshot.openClassC),
      checklistItemIds: ["open-class-c-q0"],
    });
  }

  // 2. Class B listed as open.
  if (snapshot.openClassB !== null && snapshot.openClassB > 0) {
    insights.push({
      id: "open-class-b",
      priority: insights.length + 1,
      title: "Ask about the Class B violations listed as open",
      finding: `City records list ${plural(snapshot.openClassB, "Class B violation")} as open at this building.`,
      interpretation:
        "Class B covers hazardous conditions such as leaks, mold, or broken plumbing. Listed as open means no correction has been recorded, not that the problem is present in this apartment today.",
      nextStep:
        "Ask how long these have been open and whether any affect the apartment you are viewing.",
      coveredPeriod: "Violations currently listed as open",
      evidence: classEvidence("B", snapshot.openClassB),
      checklistItemIds: ["open-class-b-q0"],
    });
  }

  // 3. Categories repeated in at least two of the last three completed years.
  const repeated = issues
    .filter((i) => i.name !== "Other" && i.repeatedRecently)
    .sort(
      (a, b) =>
        (totals.get(b.name) ?? 0) - (totals.get(a.name) ?? 0) ||
        a.name.localeCompare(b.name),
    );

  for (const issue of repeated) {
    if (insights.length >= MAX_INSIGHTS) break;
    represented.add(issue.name);
    insights.push(repeatedInsight(issue, insights.length + 1, building.bin, now));
  }

  // 4. Fill remaining slots with the most reported categories in the window -
  //    but only where reports actually exist. Empty slots beat invented concerns.
  if (insights.length < MAX_INSIGHTS) {
    for (const category of rankCategories(totals)) {
      if (insights.length >= MAX_INSIGHTS) break;
      if (represented.has(category)) continue;
      const issue = issues.find((i) => i.name === category);
      if (!issue) continue;
      represented.add(category);
      insights.push(reportedInsight(issue, insights.length + 1, building.bin, covered, totals.get(category) ?? 0));
    }
  }

  // 5. Nothing qualified: state the record neutrally rather than inventing a concern.
  if (insights.length === 0) {
    insights.push(sparseInsight(input, covered));
  }

  return { insights, checklist: buildChecklist(insights, issues, represented) };
}

function repeatedInsight(
  issue: IssueSummary,
  priority: number,
  bin: string,
  now: Date,
): Insight {
  const years = issue.recentYears;
  const window = recentCompletedYears(now);
  const historical =
    issue.historicalYears.length > 0
      ? ` The same category also appears in ${listYears(issue.historicalYears)}.`
      : "";

  return {
    id: `repeated-${slug(issue.name)}`,
    priority,
    title: `Ask about repeated ${issue.name.toLowerCase()} problems`,
    finding: `${issue.name} problems were reported in ${listYears(years)} — ${years.length} of the last ${window.length} completed years.${historical}`,
    interpretation:
      "Reports in separate years suggest the issue came back rather than being a single event. The records do not show whether the same apartment was affected or whether repairs were made in between.",
    nextStep: `Ask what ${issue.name.toLowerCase()} repairs were made and whether problems continued afterwards.`,
    coveredPeriod: `${window[0]}–${window[window.length - 1]} (completed years)`,
    evidence: evidenceFor(
      issue.byYear
        .filter((p) => window.includes(p.year))
        .map((p) => ({
          label: String(p.year),
          value: plural(p.count, "reported problem"),
          detail: null,
        })),
      [],
      null,
      [
        { label: "HPD complaint problems dataset", url: DATASET_PAGES.complaints, raw: false },
        {
          label: `Reported problems for BIN ${bin}`,
          url: problemsSourceUrl(bin),
          raw: true,
        },
      ],
    ),
    checklistItemIds: [`repeated-${slug(issue.name)}-q0`],
  };
}

function reportedInsight(
  issue: IssueSummary,
  priority: number,
  bin: string,
  covered: string,
  total: number,
): Insight {
  return {
    id: `reported-${slug(issue.name)}`,
    priority,
    title: `Ask about ${issue.name.toLowerCase()} problems`,
    finding: `${issue.name} is the most reported category here in ${covered}, with ${plural(total, "reported problem")}.`,
    interpretation:
      "Reported problems are rows recorded against complaints to HPD, not distinct complaints, residents, or incidents. They show what was reported, not what was found or fixed.",
    nextStep: `Ask whether ${issue.name.toLowerCase()} problems have affected this apartment and what was done.`,
    coveredPeriod: covered,
    evidence: evidenceFor(
      issue.byYear.map((p) => ({
        label: String(p.year),
        value: plural(p.count, "reported problem"),
        detail: null,
      })),
      [],
      null,
      [
        { label: "HPD complaint problems dataset", url: DATASET_PAGES.complaints, raw: false },
        { label: `Reported problems for BIN ${bin}`, url: problemsSourceUrl(bin), raw: true },
      ],
    ),
    checklistItemIds: [`reported-${slug(issue.name)}-q0`],
  };
}

function sparseInsight(input: InsightInputs, covered: string): Insight {
  const { snapshot, building } = input;
  const parts: string[] = [];

  if (snapshot.totalOpenViolations !== null) {
    parts.push(
      snapshot.totalOpenViolations === 0
        ? "no violations listed as open"
        : plural(snapshot.totalOpenViolations, "violation") + " listed as open",
    );
  }
  if (snapshot.reportedProblemsLast12Months !== null) {
    parts.push(
      `${plural(snapshot.reportedProblemsLast12Months, "problem")} reported in the past 12 months`,
    );
  }

  return {
    id: "record-summary",
    priority: 1,
    title: "Few records for this building",
    finding:
      parts.length > 0
        ? `City records show ${parts.join(" and ")}.`
        : "We could not retrieve enough records to summarise this building.",
    interpretation:
      "A sparse record is not evidence that a building is well maintained. Residents may not have reported problems, and records only cover what was reported to the city.",
    nextStep:
      "Use general maintenance questions at the viewing, and ask how repairs are requested and how quickly they are handled.",
    coveredPeriod: covered,
    evidence: evidenceFor(
      [],
      [],
      null,
      [
        { label: "HPD violations dataset", url: DATASET_PAGES.violations, raw: false },
        {
          label: `Open violations for BIN ${building.bin}`,
          url: violationsSourceUrl(building.bin),
          raw: true,
        },
      ],
    ),
    checklistItemIds: [],
  };
}

/* --------------------------------------------------------------- checklist */

function buildChecklist(
  insights: Insight[],
  issues: IssueSummary[],
  represented: Set<IssueCategory>,
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const seen = new Set<string>();

  const push = (item: ChecklistItem) => {
    if (items.length >= MAX_CHECKLIST_ITEMS || seen.has(item.text)) return;
    seen.add(item.text);
    items.push(item);
  };

  for (const insight of insights) {
    push({
      id: `${insight.id}-q0`,
      text: insight.nextStep,
      kind: "question",
      insightId: insight.id,
    });
  }

  // Category-specific follow-ups, then general ones if there is still room.
  for (const category of represented) {
    for (const [i, entry] of CATEGORY_QUESTIONS[category].entries()) {
      push({
        id: `${slug(category)}-extra-${i}`,
        text: entry.text,
        kind: entry.kind,
        insightId:
          insights.find((n) => n.id.endsWith(slug(category)))?.id ?? null,
      });
    }
  }

  for (const [i, entry] of GENERAL_CHECKLIST.entries()) {
    push({ id: `general-${i}`, text: entry.text, kind: entry.kind, insightId: null });
  }

  void issues;
  return items;
}
