"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, X } from "lucide-react";
import { inNycArea } from "@/lib/osm/geo";
import { clock, nycNowMin, nycToday, toHHMM, toMinutes } from "@/lib/plan/time";
import type { DayPlan, PointLabel } from "@/lib/plan/types";
import { useFocusTrap } from "./useFocusTrap";

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
  const dialogRef = useRef<HTMLElement>(null);
  useFocusTrap(dialogRef);

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
      <div aria-hidden onClick={onClose} className="pl-scrim" />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="replan-title" className="pl-sheet dialog">
        <div className="pl-sheet-pad">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="pl-mono pl-kicker">Running late?</p>
              <h2 id="replan-title" className="pl-h2">
                Re-plan <em>from here</em>
              </h2>
              <p className="pl-dek">We&apos;ll redo the rest of the day from where you are.</p>
            </div>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="pl-icon" style={{ borderColor: "var(--rule)" }}>
              <X aria-hidden />
            </button>
          </div>

          {plan.request.date !== today && <p className="pl-note">This plan is for another day; re-planning uses today, {today}.</p>}

          <label className="pl-field">
            <span className="pl-mono">Time now</span>
            <input
              type="time"
              value={toHHMM(now)}
              onChange={(e) => {
                const m = toMinutes(e.target.value);
                if (m !== null) setNow(m);
              }}
              className="pl-input w-fit"
            />
          </label>

          <fieldset>
            <legend className="pl-mono pl-muted mb-2">Already done</legend>
            <ul style={{ borderTop: "1px solid var(--rule)" }}>
              {plan.stops.map((s) => (
                <li key={s.key} style={{ borderBottom: "1px solid var(--hair)" }}>
                  <label className="flex cursor-pointer items-center gap-3 py-2 pl-small">
                    <input type="checkbox" checked={done.has(s.key)} onChange={(e) => setManual((m) => new Map(m).set(s.key, e.target.checked))} className="pl-check" />
                    <span className={done.has(s.key) ? "pl-muted line-through" : ""}>{s.name}</span>
                    <span className="pl-mono pl-muted ml-auto">{clock(s.startMin)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset>
            <legend className="pl-mono pl-muted mb-2">Starting from</legend>
            <div className="pl-chips">
              <button type="button" onClick={locate} aria-pressed={where === "here"} className="pl-chip">
                {locating ? <Loader2 className="animate-spin" aria-hidden /> : <LocateFixed aria-hidden />}
                {here ? "Your location" : "Use my location"}
              </button>
              {lastDone && (
                <button type="button" onClick={() => setWhere("last")} aria-pressed={where === "last"} className="pl-chip">
                  {lastDone.name}
                </button>
              )}
              {plan.request.origin && (
                <button type="button" onClick={() => setWhere("start")} aria-pressed={where === "start"} className="pl-chip">
                  {plan.request.origin.label}
                </button>
              )}
            </div>
            {locError && <p className="pl-flag mt-2">{locError}</p>}
          </fieldset>

          <button type="button" onClick={() => from && onReplan({ keep, from, startMin: now })} disabled={!canGo} className="ed-btn w-full">
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {left === 0 ? "Nothing left to plan" : now >= plan.request.endMin ? "Your day has ended" : `Re-plan ${left} stop${left > 1 ? "s" : ""} from ${clock(now)}`}
          </button>
          {!from && where === "here" && !locating && <p className="pl-small pl-muted text-center">Share your location, or pick where to start.</p>}
        </div>
      </section>
    </>
  );
}
