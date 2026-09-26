"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inNycArea } from "@/lib/osm/geo";
import { clock, nycNowMin, nycToday, toHHMM, toMinutes } from "@/lib/plan/time";
import type { DayPlan, PointLabel } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

export interface ReplanChoice {
  /** Stops still to do, by key. */
  keep: Set<string>;
  from: PointLabel;
  startMin: number;
}

/**
 * Mid-day reset: where you are, what time it is, what's already done. The rest
 * of the day is planned again from there. Time and place can be set by hand, so
 * it also works away from New York (and in a demo).
 */
export function ReplanDialog({ plan, busy, onReplan, onClose }: { plan: DayPlan; busy: boolean; onReplan: (c: ReplanChoice) => void; onClose: () => void }) {
  const today = nycToday();
  const [now, setNow] = useState(() => nycNowMin());
  const places = plan.stops.filter((s) => !s.meal || s.attractionId);
  // Anything scheduled to be over by "now" counts as done, following the time as it's edited;
  // a box the reader ticks or clears by hand stays that way.
  const [manual, setManual] = useState<Map<string, boolean>>(() => new Map());
  const done = new Set(plan.stops.filter((s) => manual.get(s.key) ?? s.endMin <= now).map((s) => s.key));
  const lastDone = [...places].reverse().find((s) => done.has(s.key)) ?? null;
  const [where, setWhere] = useState<"here" | "last" | "start">(lastDone ? "last" : plan.request.origin ? "start" : "here");
  const [here, setHere] = useState<PointLabel | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function locate() {
    setWhere("here");
    if (!navigator.geolocation) return setLocError("This browser can't share its location.");
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if (!inNycArea(p)) return setLocError("You seem to be outside New York City. Pick a stop to start from instead.");
        setHere({ label: "Your location", ...p });
      },
      () => {
        setLocating(false);
        setLocError("Couldn't get your location. Pick a stop to start from instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const from: PointLabel | null =
    where === "here" ? here : where === "last" && lastDone ? { label: lastDone.name, lat: lastDone.lat, lon: lastDone.lon } : plan.request.origin;
  const keep = new Set(plan.stops.filter((s) => !done.has(s.key) && !(s.meal && !s.attractionId)).map((s) => s.key));
  const left = plan.stops.filter((s) => keep.has(s.key)).length;
  const canGo = from !== null && left > 0 && now < plan.request.endMin && !busy;

  return (
    <>
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 z-40 bg-black/30" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="replan-title"
        className="animate-rise neo-raised-lg fixed inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl p-6 sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(440px,calc(100vw_-_2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="replan-title" className="font-display text-3xl leading-tight">
              Re-plan from here
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Running late or changed your mind? We&apos;ll redo the rest of the day.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="neo-control grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground">
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {plan.request.date !== today && (
          <p className="neo-raised mt-4 rounded-xl p-3 text-xs border-brand/20">This plan is for another day; re-planning uses today, {today}.</p>
        )}

        <div className="mt-5 space-y-5">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Time now</span>
            <input
              type="time"
              value={toHHMM(now)}
              onChange={(e) => {
                const m = toMinutes(e.target.value);
                if (m !== null) setNow(m);
              }}
              className="neo-inset rounded-lg px-2.5 py-1.5 text-sm tabular-nums bg-transparent"
            />
          </label>

          <fieldset>
            <legend className="text-sm font-medium">Already done</legend>
            <ul className="mt-2 space-y-1">
              {plan.stops.map((s) => (
                <li key={s.key}>
                  <label className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={done.has(s.key)}
                      onChange={(e) => setManual((m) => new Map(m).set(s.key, e.target.checked))}
                      className="size-4 accent-(--brand)"
                    />
                    <span className={done.has(s.key) ? "text-muted-foreground line-through" : ""}>{s.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">{clock(s.startMin)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">Starting from</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={locate}
                aria-pressed={where === "here"}
                className={cn("neo-control inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition", where === "here" && "neo-inset text-brand font-semibold")}
              >
                {locating ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <LocateFixed className="size-3.5" aria-hidden />}
                {here ? "Your location" : "Use my location"}
              </button>
              {lastDone && (
                <button
                  type="button"
                  onClick={() => setWhere("last")}
                  aria-pressed={where === "last"}
                  className={cn("neo-control rounded-full px-3 py-1.5 text-xs font-medium transition", where === "last" && "neo-inset text-brand font-semibold")}
                >
                  {lastDone.name}
                </button>
              )}
              {plan.request.origin && (
                <button
                  type="button"
                  onClick={() => setWhere("start")}
                  aria-pressed={where === "start"}
                  className={cn("neo-control rounded-full px-3 py-1.5 text-xs font-medium transition", where === "start" && "neo-inset text-brand font-semibold")}
                >
                  {plan.request.origin.label}
                </button>
              )}
            </div>
            {locError && <p className="mt-2 text-xs text-sev-c">{locError}</p>}
          </fieldset>
        </div>

        <Button
          onClick={() => from && onReplan({ keep, from, startMin: now })}
          disabled={!canGo}
          className="neo-primary mt-6 h-11 w-full rounded-xl text-[15px] font-semibold"
        >
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {left === 0 ? "Nothing left to plan" : now >= plan.request.endMin ? "Your day has ended" : `Re-plan ${left} stop${left > 1 ? "s" : ""} from ${clock(now)}`}
        </Button>
        {!from && where === "here" && !locating && <p className="mt-2 text-center text-xs text-muted-foreground">Share your location, or pick where to start.</p>}
      </section>
    </>
  );
}
