import { CATEGORY_ICONS } from "@/lib/nyc/classify";
import type { IssueSummary } from "@/lib/nyc/types";

function count(n: number, noun: string) {
  return `${n.toLocaleString()} ${noun}${n === 1 ? "" : "s"}`;
}

function list(years: number[]) {
  if (years.length === 0) return "";
  if (years.length === 1) return String(years[0]);
  return `${years.slice(0, -1).join(", ")} and ${years[years.length - 1]}`;
}

function IssueCard({ issue }: { issue: IssueSummary }) {
  const max = Math.max(1, ...issue.byYear.map((p) => p.count));

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="text-xl">
            {CATEGORY_ICONS[issue.name]}
          </span>
          <h3 className="text-lg font-medium">{issue.name}</h3>
        </div>
        {issue.repeatedRecently && (
          <span className="shrink-0 rounded-full bg-sev-b-soft px-2.5 py-1 text-xs font-medium text-sev-b">
            Repeated recently
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {count(issue.reportedProblems, "reported problem")} &middot;{" "}
        {count(issue.violations, "violation")}
      </p>

      {/* Exact years, never "for N years running" - the records do not show
          that the problem persisted between reports. */}
      {issue.recentYears.length > 0 ? (
        <p className="mt-3 text-[15px] leading-relaxed">
          Reported in {list(issue.recentYears)}.
        </p>
      ) : (
        issue.historicalYears.length > 0 && (
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Last reported in {issue.historicalYears[issue.historicalYears.length - 1]}.
          </p>
        )
      )}

      {issue.historicalYears.length > 0 && issue.recentYears.length > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          Earlier reports: {list(issue.historicalYears)}.
        </p>
      )}

      {issue.byYear.length > 1 && (
        <ul className="mt-4 space-y-1.5">
          {issue.byYear.slice(-5).map((point) => (
            <li
              key={point.year}
              className="grid grid-cols-[3.2rem_1fr_2.5rem] items-center gap-2 text-xs"
            >
              <span className="tabular-nums text-muted-foreground">{point.year}</span>
              <span className="h-1.5 rounded-full bg-accent">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{ width: `${Math.max(4, (point.count / max) * 100)}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-muted-foreground">
                {point.count.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function IssuesSection({
  issues,
  available,
  windowLabel,
}: {
  issues: IssueSummary[];
  available: boolean;
  windowLabel: string;
}) {
  if (!available) {
    return (
      <p className="rounded-2xl border border-border bg-sev-b-soft p-6 text-[15px] leading-relaxed">
        Reported problem records are unavailable right now, so we cannot show what
        residents have reported at this building.
      </p>
    );
  }

  const shown = issues.filter((i) => i.name !== "Other").slice(0, 6);
  const other = issues.find((i) => i.name === "Other");

  if (shown.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-[15px] leading-relaxed text-muted-foreground">
        No records found for heating, hot water, pests, mold, leaks, or electrical
        problems in {windowLabel}.
        {other && " The records that do exist did not fall into one of these categories."}
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {shown.map((issue) => (
          <IssueCard key={issue.name} issue={issue} />
        ))}
      </div>
      {other && (
        <p className="mt-4 text-sm text-muted-foreground">
          A further {count(other.reportedProblems, "reported problem")} and{" "}
          {count(other.violations, "violation")} covered other things such as
          paint, flooring, doors, or smoke detectors.
        </p>
      )}
    </>
  );
}
