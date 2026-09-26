"use client";

import { useEffect, useState } from "react";
import { Navigation, RotateCcw } from "lucide-react";
import { LEG_VERB } from "@/lib/plan/display";
import { departureFor, nextStep, type NextStep } from "@/lib/plan/live";
import { mapsDirections, mapsPoint } from "@/lib/plan/maps";
import { isMealBreak } from "@/lib/plan/profile";
import { clock, duration, nycNowMin } from "@/lib/plan/time";
import type { DayPlan, PlannedStop } from "@/lib/plan/types";

/** Minutes after midnight in New York, refreshed every 20 seconds. */
export function useNycNow(): number {
  const [now, setNow] = useState(() => nycNowMin());
  useEffect(() => {
    const id = window.setInterval(() => setNow(nycNowMin()), 20_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** "in 12 min", "in 1h 5m", "now". */
const until = (min: number) => (min <= 0 ? "now" : `in ${duration(min)}`);

/** One line for the sheet's header on a phone: the next thing to do. */
export function nextLine(step: NextStep, now: number): string {
  switch (step.kind) {
    case "before":
      return `Leave for ${step.stop.name} ${until(step.leaveBy - now)}`;
    case "at":
      return step.next ? `At ${step.stop.name} · leave ${until(departureFor(step.next) - now)}` : `At ${step.stop.name} · last stop`;
    case "moving":
      return `On the way to ${step.to.name} · ${clock(step.arriveBy)}`;
    case "done":
      return "That's the day. Nice one.";
  }
}

/**
 * On the day itself: where you should be right now, when to leave, and how to
 * get to the next stop, with one tap to directions or to re-plan if running late.
 */
export function NextUp({ plan, onReplan }: { plan: DayPlan; onReplan: () => void }) {
  const now = useNycNow();
  const step = nextStep(plan, now);
  if (step.kind === "done") return null;

  // The leg to act on next, and where it starts.
  const target: PlannedStop | null = step.kind === "before" ? step.stop : step.kind === "at" ? step.next : step.to;
  const from = step.kind === "at" ? step.stop : step.kind === "moving" ? step.from : null;
  const origin = from && !isMealBreak(from) ? mapsPoint(from) : plan.request.origin ? mapsPoint(plan.request.origin) : null;
  const leg = target?.leg ?? null;
  // No known start point: Google Maps starts from wherever the phone is.
  const directions =
    target && !isMealBreak(target)
      ? origin && leg
        ? mapsDirections(origin, mapsPoint(target), leg.mode)
        : `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: mapsPoint(target).query, travelmode: "transit" })}`
      : null;
  const leaveBy = target ? departureFor(target) : null;

  const headline = step.kind === "before" ? `First up: ${step.stop.name}` : step.kind === "at" ? `You're at ${step.stop.name}` : `Heading to ${step.to.name}`;
  const detail =
    step.kind === "moving"
      ? `Arrive around ${clock(step.arriveBy)}${leg ? ` · ${duration(leg.minutes)} ${LEG_VERB[leg.mode]}` : ""}`
      : target && leaveBy !== null
        ? `${step.kind === "at" ? `Next: ${target.name}. ` : ""}Leave by ${clock(leaveBy)}${leg ? ` · ${duration(leg.minutes)} ${LEG_VERB[leg.mode]}` : ""}`
        : `Until ${clock((step as { until: number }).until)}. This is your last stop.`;
  const countdown = step.kind === "moving" ? step.arriveBy - now : leaveBy !== null ? leaveBy - now : null;

  return (
    <section
      aria-label="Right now"
      aria-live="polite"
      className="neo-raised mb-5 overflow-hidden rounded-3xl border border-white/15 bg-[radial-gradient(130%_130%_at_0%_0%,var(--brand)_0%,oklch(0.32_0.12_275)_60%,oklch(0.22_0.06_265)_100%)] p-4 text-white"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-white/80">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
            <span className="relative inline-flex size-2 rounded-full bg-white" />
          </span>
          Live · {clock(now)}
        </span>
        {countdown !== null && (
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums backdrop-blur">
            {step.kind === "moving" ? "Arrive" : "Leave"} {until(countdown)}
          </span>
        )}
      </div>
      <h2 className="mt-2 font-display text-3xl leading-tight">{headline}</h2>
      <p className="mt-1 text-sm text-white/85">{detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {directions && (
          <a
            href={directions}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-[oklch(0.25_0.08_270)] shadow-[0_3px_8px_rgba(0,0,0,0.25)] transition hover:shadow-sm active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
          >
            <Navigation className="size-4" aria-hidden /> Directions
          </a>
        )}
        <button
          type="button"
          onClick={onReplan}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-semibold backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] transition hover:bg-white/25 active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
        >
          <RotateCcw className="size-4" aria-hidden /> Running late?
        </button>
      </div>
    </section>
  );
}
