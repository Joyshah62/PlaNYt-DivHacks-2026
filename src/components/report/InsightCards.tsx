"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, ExternalLink, Plus } from "lucide-react";
import { ClassBadge } from "./ClassBadge";
import { useChecklist } from "@/lib/checklist";
import { CATEGORY_ICONS } from "@/lib/nyc/classify";
import type { Insight } from "@/lib/nyc/types";

function formatDate(iso: string | null) {
  if (!iso) return "date not recorded";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EvidencePanel({ insight }: { insight: Insight }) {
  const { evidence } = insight;
  return (
    <div className="space-y-5 border-t border-border px-5 py-5 text-sm">
      <p className="text-muted-foreground">
        Covering {insight.coveredPeriod}.
      </p>

      {evidence.items.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5">
          {evidence.items.map((item) => (
            <div key={item.label} className="contents">
              <dt className="tabular-nums text-muted-foreground">{item.label}</dt>
              <dd>
                {item.value}
                {item.detail && (
                  <span className="text-muted-foreground"> · {item.detail}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {evidence.records.length > 0 && (
        <div>
          <p className="mb-2.5 font-medium">Supporting records</p>
          <ul className="space-y-2.5">
            {evidence.records.map((record) => (
              <li key={record.id} className="rounded-xl bg-accent/60 p-3.5">
                <ClassBadge violationClass={record.class} />
                <p className="mt-2 flex items-center gap-1.5">
                  <span aria-hidden>{CATEGORY_ICONS[record.category]}</span>
                  {record.category}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Inspected {formatDate(record.reportedOn)} · listed as{" "}
                  {record.status.toLowerCase()}
                </p>
                {record.description && (
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {record.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {evidence.recordsCappedFrom !== null && (
            <p className="mt-2.5 text-muted-foreground">
              Showing {evidence.records.length} of{" "}
              {evidence.recordsCappedFrom.toLocaleString()} matching records.
            </p>
          )}
        </div>
      )}

      {evidence.links.length > 0 && (
        <div>
          <p className="mb-2 font-medium">Official sources</p>
          <ul className="space-y-1.5">
            {evidence.links.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
                >
                  {link.label}
                  {link.raw && (
                    <span className="text-muted-foreground">(raw data)</span>
                  )}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const checklist = useChecklist();
  const added = checklist.has(`${insight.id}-q0`);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-5 sm:p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand">{index === 0 ? "First finding" : `Finding ${index + 1}`} <span className="font-normal text-muted-foreground"> · {insight.coveredPeriod}</span></p>
        <h3 className="text-lg font-medium leading-snug text-pretty">
          {insight.title}
        </h3>

        <dl className="mt-3.5 space-y-3 text-[15px] leading-relaxed">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              What the records show
            </dt>
            <dd className="mt-1 text-pretty">{insight.finding}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              How to read this
            </dt>
            <dd className="mt-1 text-pretty text-muted-foreground">
              {insight.interpretation}
            </dd>
          </div>
          <div className="border-l-2 border-brand pl-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-brand">
              Ask at your viewing
            </dt>
            <dd className="mt-1 text-pretty">{insight.nextStep}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm transition hover:bg-accent"
          >
            {open ? "Hide evidence" : "Check evidence and sources"}
            <ChevronDown
              aria-hidden
              className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={() =>
              added
                ? checklist.remove(`${insight.id}-q0`)
                : checklist.add({
                    id: `${insight.id}-q0`,
                    text: insight.nextStep,
                    kind: "question",
                  })
            }
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${
              added
                ? "bg-accent text-muted-foreground"
                : "bg-accent text-foreground hover:bg-border"
            }`}
          >
            {added ? (
              <>
                <Check className="size-3.5" aria-hidden /> On your checklist
              </>
            ) : (
              <>
                <Plus className="size-3.5" aria-hidden /> Add to checklist
              </>
            )}
          </button>
        </div>
      </div>

      <div id={panelId} hidden={!open}>
        {open && <EvidencePanel insight={insight} />}
      </div>
    </article>
  );
}

export function InsightCards({
  insights,
  notAssessed,
}: {
  insights: Insight[];
  notAssessed: string[];
}) {
  return (
    <div className="space-y-3">
      {notAssessed.length > 0 && <p className="border-l-2 border-sev-b pl-4 text-sm leading-relaxed">This report is incomplete. Missing records may affect which findings appear first.</p>}
      {insights[0] && <InsightCard key={insights[0].id} insight={insights[0]} index={0} />}
      {insights.slice(1).map((insight, index) => (
        <details key={insight.id} className="border-b border-border py-4">
          <summary className="cursor-pointer text-[15px] font-medium">{insight.title}<span className="mt-1 block pl-4 text-xs font-normal text-muted-foreground">{insight.coveredPeriod} · Expand finding</span></summary>
          <div className="mt-4"><InsightCard insight={insight} index={index + 1} /></div>
        </details>
      ))}
      {insights.length === 0 && <p className="py-4 text-sm text-muted-foreground">No findings could be generated from the available records. Review source coverage below before drawing a conclusion.</p>}

      {notAssessed.length > 0 && (
        <div className="rounded-2xl border border-border bg-sev-b-soft p-5">
          <h3 className="text-[15px] font-medium">What we could not check</h3>
          <ul className="mt-2.5 space-y-1.5 text-sm leading-relaxed text-pretty">
            {notAssessed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
