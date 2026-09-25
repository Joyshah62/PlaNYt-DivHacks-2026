import type { BuildingReport, IssueCategory } from "./types";

export const ISSUE_GUIDES: Record<IssueCategory, { label: string; question: string; check: string }> = {
  Heating: { label: "Heat", question: "Were there heat interruptions last winter, and what repairs were made?", check: "Ask how to report a heating outage and who responds after hours." },
  "Hot Water": { label: "Hot water", question: "Has this apartment lost hot water recently, and was the cause fixed?", check: "Run the hot tap during the viewing and check the water pressure." },
  Pests: { label: "Pests", question: "When was this apartment last treated, and is there a regular pest-control service?", check: "Look under sinks and along baseboards for droppings and gaps." },
  Mold: { label: "Mold", question: "Was mold found in this apartment, and was the moisture source fixed?", check: "Look for staining around windows, bathroom ceilings, and closet corners." },
  Leaks: { label: "Leaks", question: "Where did previous leaks come from, and what was repaired?", check: "Look for water stains on ceilings and under sinks." },
  Electrical: { label: "Electrical", question: "Have there been electrical problems in this apartment, and what work was done?", check: "Ask about nonworking outlets and frequently tripped breakers." },
  Other: { label: "Other issues", question: "What other repairs are outstanding in this apartment or shared areas?", check: "Check windows, doors, and shared spaces during the viewing." },
};

export function exploreIssues(report: BuildingReport, span: 4 | 10) {
  const year = new Date(report.generatedAt).getFullYear();
  const available = report.queries.some((q) => q.name === "problemCategories" && q.ok);
  const years = Array.from({ length: span }, (_, index) => year - span + 1 + index);
  return (Object.keys(ISSUE_GUIDES) as IssueCategory[]).map((category) => {
    const issue = report.issues.find((i) => i.name === category);
    const points = years.map((y) => ({ year: y, count: available ? (issue?.byYear.find((p) => p.year === y)?.count ?? 0) : null }));
    const total = available ? points.reduce((sum, p) => sum + (p.count ?? 0), 0) : null;
    const completed = points.filter((p) => p.year < year && (p.count ?? 0) > 0);
    const last = points.filter((p) => (p.count ?? 0) > 0).at(-1)?.year ?? null;
    const status = !available ? "Data unavailable" : total === 0 ? "No reports in this period" : completed.length >= 2 ? "Reported in multiple years" : last === year ? "Reported this year" : `Last reported ${last}`;
    return { category, ...ISSUE_GUIDES[category], points, total, status, last };
  }).sort((a, b) => (b.total ?? 0) - (a.total ?? 0) || a.category.localeCompare(b.category));
}
