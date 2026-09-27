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
    <section aria-label="Right now" aria-live="polite" className="pl-now">
      <div className="pl-mono flex items-center justify-between gap-3">
        <span className="pl-kicker inline-flex items-center">
          <span className="pl-live" aria-hidden />
          Live · {clock(now)}
        </span>
        {countdown !== null && (
          <span>
            {step.kind === "moving" ? "Arrive" : "Leave"} {until(countdown)}
          </span>
        )}
      </div>
      <h2>{headline}</h2>
      <p className="pl-dek">{detail}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {directions && (
          <a href={directions} target="_blank" rel="noreferrer" className="ed-btn">
            <Navigation className="size-4" aria-hidden /> Directions
          </a>
        )}
        <button type="button" onClick={onReplan} className="ed-btn ed-btn--ghost">
          <RotateCcw className="size-4" aria-hidden /> Running late?
        </button>
      </div>
    </section>
  );
}
