import { CLASS_INFO } from "@/lib/severity";
import { CATEGORY_ICONS } from "@/lib/nyc/classify";
import type { Snapshot } from "@/lib/nyc/types";

function Stat({
  value,
  unavailable,
  label,
  sub,
  accent,
}: {
  value: string;
  unavailable: boolean;
  label: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
      {accent && <span className={`absolute inset-x-0 top-0 h-1 ${accent}`} />}
      <p
        className={
          unavailable
            ? "text-lg font-medium text-muted-foreground"
            : "text-3xl font-semibold tracking-tight tabular-nums"
        }
      >
        {value}
      </p>
      <p className="mt-2.5 text-[15px] font-medium leading-snug">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

/**
 * Null means the query failed and we know nothing - shown as "Unavailable", never
 * as zero. Zero means the query succeeded and found nothing.
 */
export function StatCards({
  snapshot,
  reportingPeriod,
}: {
  snapshot: Snapshot;
  reportingPeriod: string;
}) {
  const count = (value: number | null) =>
    value === null ? "Unavailable" : value.toLocaleString();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        value={count(snapshot.openClassC)}
        unavailable={snapshot.openClassC === null}
        label="Class C violations listed as open"
        sub={CLASS_INFO.C.label}
        accent={snapshot.openClassC ? CLASS_INFO.C.accent : undefined}
      />
      <Stat
        value={count(snapshot.openClassB)}
        unavailable={snapshot.openClassB === null}
        label="Class B violations listed as open"
        sub={CLASS_INFO.B.label}
        accent={snapshot.openClassB ? CLASS_INFO.B.accent : undefined}
      />
      <Stat
        value={count(snapshot.reportedProblemsLast12Months)}
        unavailable={snapshot.reportedProblemsLast12Months === null}
        label="Problems reported"
        sub="Past 12 months"
      />
      <Stat
        value={
          snapshot.mostReportedIssue
            ? `${CATEGORY_ICONS[snapshot.mostReportedIssue]} ${snapshot.mostReportedIssue}`
            : "None"
        }
        unavailable={snapshot.mostReportedIssue === null}
        label="Most reported category"
        sub={reportingPeriod}
      />
    </div>
  );
}
