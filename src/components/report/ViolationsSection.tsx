"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ClassBadge } from "./ClassBadge";
import { CATEGORY_ICONS } from "@/lib/nyc/classify";
import type { RecentViolation } from "@/lib/nyc/types";

function formatDate(iso: string | null) {
  if (!iso) return "Date not recorded";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ViolationRow({ violation }: { violation: RecentViolation }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <ClassBadge violationClass={violation.class} />
          <p className="mt-2.5 flex items-center gap-2 text-[15px] font-medium">
            <span aria-hidden>{CATEGORY_ICONS[violation.category]}</span>
            {violation.category}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Inspected {formatDate(violation.reportedOn)} &middot; listed as{" "}
            {violation.status.toLowerCase()}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm transition hover:bg-accent"
        >
          {open ? "Hide details" : "View details"}
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* The official legal text stays hidden until asked for - it is the single
          biggest source of government-portal feel. */}
      {open && (
        <p className="border-t border-border px-5 py-4 text-sm leading-relaxed text-muted-foreground">
          {violation.description || "No description was recorded for this violation."}
        </p>
      )}
    </li>
  );
}

/** Enough to show the pattern without the page turning into a records dump. */
const INITIAL_COUNT = 5;

export function ViolationsSection({
  violations,
  totalOpen,
  available,
}: {
  violations: RecentViolation[];
  totalOpen: number | null;
  available: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!available) {
    return (
      <p className="rounded-2xl border border-border bg-sev-b-soft p-6 text-[15px] leading-relaxed">
        Violation records are unavailable right now, so we cannot tell you whether
        this building has violations listed as open.
      </p>
    );
  }

  if (violations.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-[15px] leading-relaxed text-muted-foreground">
        No records found. No violations are currently listed as open for this
        building. That reflects what the city has recorded, not an inspection of
        the apartment you are viewing.
      </p>
    );
  }

  const shown = expanded ? violations : violations.slice(0, INITIAL_COUNT);

  return (
    <>
      <ul className="space-y-3">
        {shown.map((violation) => (
          <ViolationRow key={violation.id} violation={violation} />
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {violations.length > INITIAL_COUNT && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="rounded-full border border-border px-4 py-1.5 text-sm transition hover:bg-accent"
          >
            {expanded
              ? "Show fewer"
              : `Show ${violations.length - INITIAL_COUNT} more`}
          </button>
        )}
        {totalOpen !== null && totalOpen > violations.length && (
          <p className="text-sm text-muted-foreground">
            Capped list: showing the {violations.length} most recently inspected
            of {totalOpen.toLocaleString()} violations listed as open.
          </p>
        )}
      </div>
    </>
  );
}
