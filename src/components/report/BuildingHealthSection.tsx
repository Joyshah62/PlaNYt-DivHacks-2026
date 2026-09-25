"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChecklistProvider } from "@/lib/checklist";
import type { BuildingReport } from "@/lib/nyc/types";
import type { Fetched } from "@/lib/useJson";
import { ChecklistSection } from "./ChecklistSection";
import { ProblemExplorer } from "./ProblemExplorer";
import { SectionError, SectionHeading } from "./Section";
import { SourcesSection } from "./SourcesSection";

const VIEWS = [
  ["explore", "Explore problems"],
  ["checklist", "My viewing checklist"],
  ["sources", "Sources"],
] as const;

/** The HPD record for the building: the original RentCheck report, unchanged inside. */
export function BuildingHealthSection({ building, onRetry }: { building: Fetched<BuildingReport>; onRetry: () => void }) {
  const [view, setView] = useState<(typeof VIEWS)[number][0]>("explore");
  const report = building.data;
  // Suggestions are identity-stable so the checklist merge effect does not re-run
  // on every render and clobber what the reader has done.
  const suggestions = useMemo(() => report?.checklist ?? [], [report]);

  return (
    <section aria-labelledby="building-title" className="scroll-mt-32" id="building">
      <SectionHeading
        id="building-title"
        eyebrow="Building health"
        title="What the city's housing records show"
        description="Violations and reported problems from NYC HPD, in plain English."
      />

      {building.status === "error" ? (
        <SectionError message={building.error.error} onRetry={onRetry} />
      ) : !report ? (
        <div aria-busy="true" aria-label="Checking housing records" className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-brand" /> Checking HPD violations and complaints…
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <ChecklistProvider bin={report.building.bin} suggestions={suggestions}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span>Source: NYC HPD + PLUTO</span>
            <span>
              Retrieved {new Date(report.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          {report.queries.some((q) => !q.ok) && (
            <div className="mt-4 rounded-xl border border-sev-b/30 bg-sev-b-soft p-4 text-sm">
              <p className="font-medium">Some records are unavailable. This view is incomplete.</p>
              <ul className="mt-2 space-y-1">
                {report.notAssessed.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
          <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-border print:hidden" aria-label="Building record views">
            {VIEWS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={`border-b-2 px-3 py-3 text-sm whitespace-nowrap ${view === id ? "border-brand font-semibold text-brand" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div hidden={view !== "explore"}>
            <ProblemExplorer report={report} onChecklist={() => setView("checklist")} />
          </div>
          <section hidden={view !== "checklist"} className="py-8" aria-label="My viewing checklist">
            <h3 className="text-2xl font-semibold tracking-tight">Go to the viewing prepared.</h3>
            <p className="mt-3 mb-6 text-sm text-muted-foreground">Suggested questions and the ones you save. Add answers as you go; saved on this device.</p>
            <ChecklistSection address={report.building.address} />
          </section>
          <section hidden={view !== "sources"} className="py-8" aria-label="Sources and limitations">
            <h3 className="text-2xl font-semibold tracking-tight">What this record can tell you</h3>
            <p className="mt-3 mb-6 text-sm leading-relaxed text-muted-foreground">
              City records can help you ask better questions. They cannot tell you whether to sign a lease, confirm repairs, or replace a viewing.
            </p>
            <SourcesSection queries={report.queries} />
          </section>
        </ChecklistProvider>
      )}
    </section>
  );
}
