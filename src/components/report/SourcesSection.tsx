import { DATASET_PAGES } from "@/lib/nyc/socrata";
import type { QueryName, QueryStatus } from "@/lib/nyc/types";

const QUERY_LABELS: Record<QueryName, string> = {
  building: "Building details (PLUTO)",
  violationClasses: "Violation counts by class",
  violationCategories: "Violations by category and year",
  problemCategories: "Reported problems by category and year",
  problemsRecent: "Problems reported in the past 12 months",
  openViolations: "Violations listed as open",
  seriousOpenViolations: "Class B and C violations listed as open",
};

function statusLabel(query: QueryStatus): { text: string; tone: string } {
  if (!query.ok) return { text: "Unavailable", tone: "text-sev-c" };
  if (query.empty) return { text: "No records found", tone: "text-muted-foreground" };
  return { text: "Retrieved", tone: "text-muted-foreground" };
}

function time(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SourcesSection({ queries }: { queries: QueryStatus[] }) {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Each dataset query, whether it succeeded, and when it was retrieved
          </caption>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-5 py-3 font-medium">Query</th>
              <th scope="col" className="px-5 py-3 font-medium">Result</th>
              <th scope="col" className="hidden px-5 py-3 font-medium sm:table-cell">
                Covers
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                Retrieved
              </th>
            </tr>
          </thead>
          <tbody>
            {queries.map((query) => {
              const status = statusLabel(query);
              return (
                <tr key={query.name} className="border-b border-border last:border-0">
                  <td className="px-5 py-3">{QUERY_LABELS[query.name]}</td>
                  <td className={`px-5 py-3 ${status.tone}`}>{status.text}</td>
                  <td className="hidden px-5 py-3 text-muted-foreground sm:table-cell">
                    {query.coveredPeriod}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-muted-foreground">
                    {time(query.retrievedAt)}
                    {query.durationMs !== null && (
                      <span className="ml-1.5 text-xs">
                        ({(query.durationMs / 1000).toFixed(1)}s)
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          <strong className="font-medium text-foreground">
            What these records are.
          </strong>{" "}
          Everything here comes from what residents reported to the city and what
          HPD inspectors recorded. A problem nobody reported does not appear, and
          a violation listed as open has not been recorded as corrected — that is
          not the same as confirming the condition exists today.
        </p>
        <p>
          <strong className="font-medium text-foreground">
            Reported problems are not complaints.
          </strong>{" "}
          HPD records one row per problem noted against a complaint. A single
          complaint can produce several rows, and one resident can report
          repeatedly, so these counts are not counts of distinct complaints,
          residents, or incidents.
        </p>
        <p>
          <strong className="font-medium text-foreground">
            Records describe the building.
          </strong>{" "}
          They are not specific to the apartment you are viewing unless a record
          says so.
        </p>
        <p>
          <strong className="font-medium text-foreground">Few records</strong>{" "}
          means little was reported. It is not evidence that a building is well
          maintained.
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 pt-1">
          <li>
            <a className="underline underline-offset-4 hover:text-foreground" href={DATASET_PAGES.violations} target="_blank" rel="noreferrer">
              HPD Housing Maintenance Code Violations
            </a>
          </li>
          <li>
            <a className="underline underline-offset-4 hover:text-foreground" href={DATASET_PAGES.complaints} target="_blank" rel="noreferrer">
              HPD Complaint Problems
            </a>
          </li>
          <li>
            <a className="underline underline-offset-4 hover:text-foreground" href={DATASET_PAGES.pluto} target="_blank" rel="noreferrer">
              PLUTO
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
