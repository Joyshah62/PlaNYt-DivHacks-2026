"use client";

import { useState } from "react";
import { ArrowRight, Bug, Check, ClipboardList, Droplets, ExternalLink, Flame, HelpCircle, ShieldAlert, Waves, Wind, Zap } from "lucide-react";
import { exploreIssues } from "@/lib/nyc/explorer";
import { useChecklist } from "@/lib/checklist";
import type { BuildingReport, IssueCategory } from "@/lib/nyc/types";
import { problemsSourceUrl, seriousViolationsSourceUrl } from "@/lib/nyc/queries";
import { ViolationsSection } from "./ViolationsSection";

const ICONS = { Heating: Flame, "Hot Water": Waves, Pests: Bug, Mold: Wind, Leaks: Droplets, Electrical: Zap, Other: HelpCircle };

export function ProblemExplorer({ report, onChecklist }: { report: BuildingReport; onChecklist: () => void }) {
  const [span, setSpan] = useState<4 | 10>(4);
  const issues = exploreIssues(report, span);
  const c = report.snapshot.openClassC;
  const b = report.snapshot.openClassB;
  const serious = c === null || b === null ? null : c + b;
  const [selected, setSelected] = useState<IssueCategory | "violations">(() => serious === null || serious > 0 ? "violations" : issues[0].category);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const checklist = useChecklist();
  const issue = issues.find((i) => i.category === selected) ?? issues[0];
  const year = new Date(report.generatedAt).getFullYear();
  const firstYear = year - span + 1;
  const isViolations = selected === "violations";
  const records = [...new Map([...report.openViolations, ...report.insights.flatMap((i) => i.evidence.records)].filter((r) => r.class === "B" || r.class === "C").map((r) => [r.id, r])).values()];
  const question = isViolations ? serious === null || serious === 0 ? "What repairs are outstanding in this apartment, and how are maintenance requests handled?" : "Which of these conditions affect this apartment, and can you show me what was repaired?" : issue.question;
  const questionId = `explorer-${selected}-question`;
  const saved = checklist.has(questionId);
  const count = selectedYear === null ? issue.total : issue.points.find((p) => p.year === selectedYear)?.count ?? null;
  const period = selectedYear === null ? `${firstYear}–${year} to date` : `${selectedYear}${selectedYear === year ? " to date" : ""}`;
  const max = Math.max(1, ...issue.points.map((p) => p.count ?? 0));

  function choose(value: IssueCategory | "violations") { setSelected(value); setSelectedYear(null); }

  return (
    <section className="py-8" aria-labelledby="explorer-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-brand">Before you sign</p><h2 id="explorer-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">What should you check?</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">Pick a problem. See its history. Take a specific question to your viewing.</p></div>
        <div className="flex rounded-full border border-border p-1 text-xs" role="group" aria-label="Reported problem time period">
          {([4, 10] as const).map((value) => <button key={value} type="button" aria-pressed={span === value} onClick={() => { setSpan(value); setSelectedYear(null); }} className={`rounded-full px-3 py-2 ${span === value ? "bg-foreground text-background" : "text-muted-foreground"}`}>{value === 4 ? "Recent years" : "10-year view"}</button>)}
        </div>
      </div>
      <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:grid-cols-[280px_1fr]">
        <div className="border-b border-border bg-accent/35 p-3 lg:border-r lg:border-b-0">
          <p className="px-3 py-2 text-xs text-muted-foreground">Choose an issue to explore</p>
          <div className="grid grid-cols-2 gap-1 lg:grid-cols-1" role="group" aria-label="Building issues">
            <button type="button" aria-pressed={isViolations} onClick={() => choose("violations")} className={`col-span-2 flex items-center gap-3 rounded-xl p-3 text-left lg:col-span-1 ${isViolations ? "bg-foreground text-background" : "hover:bg-accent"}`}><ShieldAlert className="size-5 shrink-0" aria-hidden /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Inspector violations</span><span className="mt-1 block text-xs opacity-75">{serious === null ? "Counts unavailable" : `${serious} hazardous listed as open`}</span></span><ArrowRight className="size-4 shrink-0" aria-hidden /></button>
            {issues.map((item) => { const Icon = ICONS[item.category]; return <button key={item.category} type="button" aria-pressed={selected === item.category} onClick={() => choose(item.category)} className={`flex items-start gap-2.5 rounded-xl p-3 text-left ${selected === item.category ? "bg-foreground text-background" : "hover:bg-accent"}`}><Icon className="mt-0.5 size-4 shrink-0" aria-hidden /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 text-sm font-medium">{item.label}<span className="tabular-nums">{item.total === null ? "—" : item.total.toLocaleString()}</span></span><span className="mt-1 block text-[11px] leading-relaxed opacity-70">{item.status}</span></span></button>; })}
          </div>
          <p className="px-3 pt-4 pb-2 text-[11px] leading-relaxed text-muted-foreground">Category counts: reported problems, {firstYear}–{year} to date. These are not counts of affected apartments.</p>
        </div>
        <div className="min-w-0 p-5 sm:p-8">
          <div aria-live="polite" aria-atomic="true">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{isViolations ? "City inspector records · currently listed as open" : `Resident-reported problems · ${period}`}</p>
            <h3 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{isViolations ? serious === null ? "We could not check open violations" : serious > 0 ? "Ask for the repair status before signing" : "No hazardous violations listed as open" : count === null ? `${issue.label}: records unavailable` : count === 0 ? `No ${issue.label.toLowerCase()} reports in this period` : `${count.toLocaleString()} ${issue.label.toLowerCase()} ${count === 1 ? "problem" : "problems"} reported`}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{isViolations ? "Inspectors recorded these conditions. Open status does not confirm they still exist or affect your apartment." : count === null ? "This source did not respond. We cannot describe the reporting history." : count === 0 ? "Nothing was recorded in this period. That does not establish the apartment is problem-free." : "These are problems reported to HPD, not necessarily confirmed by an inspector. One complaint can include several problems."}</p>
          </div>
          {isViolations ? (
            <div className="my-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border p-4"><p className="text-3xl font-semibold tabular-nums text-sev-c">{c ?? "—"}</p><p className="mt-2 text-sm font-medium">Immediately hazardous</p><p className="mt-1 text-xs text-muted-foreground">HPD Class C · listed as open</p></div>
              <div className="rounded-2xl border border-border p-4"><p className="text-3xl font-semibold tabular-nums text-sev-b">{b ?? "—"}</p><p className="mt-2 text-sm font-medium">Hazardous</p><p className="mt-1 text-xs text-muted-foreground">HPD Class B · listed as open</p></div>
            </div>
          ) : issue.total !== null ? (
            <div className="my-6">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium">When was it reported?</p><button type="button" onClick={() => setSelectedYear(null)} disabled={selectedYear === null} className="text-xs text-brand underline underline-offset-4 disabled:text-muted-foreground disabled:no-underline">Show whole period</button></div>
              <div className="mt-4 flex h-36 items-end gap-1 sm:gap-2" role="group" aria-label={`${issue.label} reported problems by year. Select a year.`}>
                {issue.points.map((point) => <button key={point.year} type="button" aria-pressed={selectedYear === point.year} aria-label={`${point.year}${point.year === year ? " year to date" : ""}: ${point.count} reported problems`} onClick={() => setSelectedYear(point.year)} className={`flex h-full min-w-0 flex-1 flex-col justify-end rounded-lg px-1 pt-1 pb-2 transition-colors ${selectedYear === point.year ? "bg-brand-soft ring-1 ring-brand" : "hover:bg-accent"}`}><span className="mb-1 text-[10px] tabular-nums text-muted-foreground">{point.count}</span><span className={`mx-auto block w-full max-w-10 rounded-t ${point.year === year ? "border border-dashed border-brand bg-brand/20" : "bg-brand/70"}`} style={{ height: `${Math.max(2, ((point.count ?? 0) / max) * 82)}px` }} /><span className="mt-2 text-[10px] tabular-nums">{span === 10 ? String(point.year).slice(-2) : point.year}{point.year === year ? "*" : ""}</span></button>)}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Select a year to inspect it. *{year} is incomplete; shorter bars do not necessarily mean improvement.</p>
            </div>
          ) : null}
          <div className="rounded-2xl bg-brand-soft p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand"><ClipboardList className="size-4" aria-hidden />Take this to your viewing</p>
            <p className="mt-3 text-lg font-medium leading-relaxed">“{question}”</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{isViolations ? "Ask to see dated repair documentation and whether these records concern the apartment you are viewing." : issue.check}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4"><button type="button" onClick={() => saved ? onChecklist() : checklist.add({ id: questionId, text: question, kind: "question" })} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-color">{saved ? <Check className="size-4" aria-hidden /> : <ClipboardList className="size-4" aria-hidden />}{saved ? "Saved · view checklist" : "Save this question"}</button><button type="button" onClick={onChecklist} className="text-sm text-brand underline underline-offset-4">My viewing checklist</button></div>
          </div>
          <details className="mt-5 border-t border-border pt-4" key={selected}>
            <summary className="cursor-pointer text-sm font-medium">Check the source behind this</summary>
            <p className="my-3 text-xs leading-relaxed text-muted-foreground">Retrieved from NYC Open Data. Counts describe the building, not a specific apartment. They are not a safety score.</p>
            {isViolations ? <div className="space-y-3">{records.length > 0 ? <><p className="text-xs text-muted-foreground">Sample of {records.length} inspector records{serious === null ? "" : ` out of ${serious} hazardous violations listed as open`}. Other records may not be included.</p><ViolationsSection violations={records} totalOpen={null} available /></> : <p className="text-sm text-muted-foreground">{serious === 0 ? "No Class B or C violations are listed as open. Other violation classes are not shown here." : "Individual supporting records were not returned in this sample. This does not mean there are no open violations."}</p>}<a href={seriousViolationsSourceUrl(report.building.bin)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand underline underline-offset-4">HPD hazardous violation records (raw data)<ExternalLink className="size-3" aria-hidden /></a></div> : <a href={problemsSourceUrl(report.building.bin)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand underline underline-offset-4">HPD problem records for this building (raw data)<ExternalLink className="size-3" aria-hidden /></a>}
          </details>
        </div>
      </div>
    </section>
  );
}
