"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { ATTRACTION_BY_ID } from "@/lib/plan/attractions";
import type { DayOutcome } from "@/lib/plan/compare";
import { crowdBand } from "@/lib/plan/crowdBand";
import { CROWD_LABEL } from "@/lib/plan/display";
import { encodePlan } from "@/lib/plan/share";
import { addDays, nycToday, WEEKDAYS } from "@/lib/plan/time";
import type { DayPlan } from "@/lib/plan/types";
import { WEATHER_LABEL, weatherKind, type DayWeather, type Forecast } from "@/lib/plan/weatherCodes";
import { Fold } from "./Fold";
import { WeatherIcon } from "./WeatherIcon";

const DAYS = 14;
const OUTDOOR = new Set(["view", "park", "landmark", "neighborhood"]);

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * How good a day is for this plan; lower is better. Closures dominate, then
 * crowds and travel, then rain in proportion to how much of the day is outside.
 */
function dayCost(d: DayOutcome, weather: DayWeather | undefined, outdoorShare: number): number {
  return d.closed.length * 100 + d.issues * 25 + d.overMin + (d.crowdLevel ?? 0.5) * 60 + d.travelMin * 0.3 + (weather ? (weather.rain / 100) * 40 * outdoorShare : 0);
}

/**
 * The same day on each of the next two weeks: weather, crowds and closures at a
 * glance, the best one starred, and a tap to move the plan there.
 */
export function DayPicker({
  plan,
  forecast,
  busy,
  onPickDate,
}: {
  plan: DayPlan;
  forecast: Forecast | null;
  busy: boolean;
  onPickDate: (date: string) => void;
}) {
  const today = nycToday();
  const { date } = plan.request;
  // Start today, unless the plan is far enough out that today would push it off the strip.
  const from = daysBetween(today, date) > DAYS - 4 ? addDays(date, -3) : today;
  // Everything but the date decides the comparison.
  const id = `${from}|${encodePlan({ ...plan.request, date: from })}`;
  const [state, setState] = useState<{ id: string; days: DayOutcome[] | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/plan/days", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: plan.request, from, count: DAYS }),
    })
      .then((res) => (res.ok ? res.json() : { days: null }))
      .catch(() => ({ days: null }))
      .then((body: { days: DayOutcome[] | null }) => {
        if (!cancelled) setState({ id, days: body.days });
      });
    return () => {
      cancelled = true;
    };
    // `id` captures everything the comparison depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const days = state?.id === id ? state.days : null;
  const loading = state?.id !== id;
  const weatherOn = useMemo(() => new Map(forecast?.days.map((d) => [d.date, d]) ?? []), [forecast]);

  const places = plan.stops.filter((s) => s.attractionId);
  const outdoorShare = places.length ? places.filter((s) => OUTDOOR.has(ATTRACTION_BY_ID.get(s.attractionId!)?.kind ?? "")).length / places.length : 0.5;
  const scored = days?.map((d) => ({ d, cost: dayCost(d, weatherOn.get(d.date), outdoorShare) })) ?? [];
  const best = scored.length ? scored.reduce((a, b) => (b.cost < a.cost ? b : a)) : null;
  const selected = scored.find((x) => x.d.date === date);

  // Keep the chosen day in view when the strip loads, the day changes, or its fold opens
  // (a folded strip has no width, so centring it then does nothing).
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const center = (behavior: ScrollBehavior) => {
      // Scroll the strip only; scrollIntoView would also move the page.
      const el = strip.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (el && strip.current) strip.current.scrollTo({ left: el.offsetLeft - (strip.current.clientWidth - el.offsetWidth) / 2, behavior });
    };
    center("smooth");
    // A strip that just unfolded is already in place, not scrolling there.
    const onToggle = () => center("instant");
    const fold = strip.current?.closest("details");
    fold?.addEventListener("toggle", onToggle);
    return () => fold?.removeEventListener("toggle", onToggle);
  }, [date, days]);

  const summary = (() => {
    if (!best || !selected) return null;
    const w = weatherOn.get(date);
    const closed = selected.d.closed.length ? `${selected.d.closed.join(", ")} ${selected.d.closed.length > 1 ? "are" : "is"} closed on ${WEEKDAYS[selected.d.dow]}s. ` : "";
    if (best.d.date === date || selected.cost - best.cost < 4) {
      return `${closed}${closed ? "Otherwise this" : "This"} is one of the best days in the next two weeks${w && w.rain < 30 ? `, and it looks ${WEATHER_LABEL[weatherKind(w.code)].toLowerCase()}` : ""}.`;
    }
    const bw = weatherOn.get(best.d.date);
    const reasons: string[] = [];
    if (selected.d.closed.length > best.d.closed.length) reasons.push("everything's open");
    if (best.d.crowdLevel !== null && selected.d.crowdLevel !== null && selected.d.crowdLevel - best.d.crowdLevel >= 0.04) {
      reasons.push(`about ${Math.round((1 - best.d.crowdLevel / selected.d.crowdLevel) * 100)}% quieter`);
    }
    if (bw && w && w.rain - bw.rain >= 25) reasons.push(`${bw.rain}% chance of rain instead of ${w.rain}%`);
    if (selected.d.travelMin - best.d.travelMin >= 5) reasons.push(`${selected.d.travelMin - best.d.travelMin} min less travel`);
    const label = new Date(`${best.d.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
    return `${closed}${label} looks better${reasons.length ? `: ${reasons.join(", ")}` : ""}.`;
  })();

  return (
    <Fold kicker="When to go" title={<>The best <em>day</em></>} summary={loading ? "Comparing weather, crowds and closures over the next two weeks…" : summary}>
      {busy && (
        <p className="pl-mono pl-muted mb-3 flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Re-planning…
        </p>
      )}
      <div ref={strip} className="pl-days" role="group" aria-label="Choose a day">
        {Array.from({ length: DAYS }, (_, i) => addDays(from, i)).map((day) => {
          const outcome = days?.find((d) => d.date === day);
          const w = weatherOn.get(day);
          const isSelected = day === date;
          const isBest = best?.d.date === day;
          const band = outcome?.crowdLevel != null ? crowdBand(outcome.crowdLevel) : null;
          const d = new Date(`${day}T12:00:00Z`);
          return (
            <button
              key={day}
              type="button"
              disabled={busy}
              aria-pressed={isSelected}
              onClick={() => !isSelected && onPickDate(day)}
              title={outcome?.closed.length ? `Closed: ${outcome.closed.join(", ")}` : band ? `${CROWD_LABEL[band]} on average` : undefined}
              className="pl-day"
            >
              {isBest && (
                <span className="pl-day-best" aria-label="Best day">
                  <Star aria-hidden />
                </span>
              )}
              <span className="pl-mono">{day === today ? "Today" : WEEKDAYS[d.getUTCDay()].slice(0, 3)}</span>
              <span className="pl-day-num">{d.getUTCDate()}</span>
              <span className="pl-day-weather">
                {w ? (
                  <>
                    <WeatherIcon code={w.code} />
                    {w.hi}°
                  </>
                ) : (
                  "–"
                )}
              </span>
              <span className="pl-day-crowd" aria-hidden>
                {loading ? null : band && <i style={{ width: `${Math.max(12, (outcome!.crowdLevel ?? 0) * 100)}%` }} />}
              </span>
              {outcome && outcome.closed.length > 0 && <span className="pl-mono pl-red" style={{ fontSize: "0.8em" }}>{outcome.closed.length} closed</span>}
            </button>
          );
        })}
      </div>
    </Fold>
  );
}
