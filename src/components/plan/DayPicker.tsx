"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Loader2, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ATTRACTION_BY_ID } from "@/lib/plan/attractions";
import type { DayOutcome } from "@/lib/plan/compare";
import { crowdBand } from "@/lib/plan/crowd";
import { CROWD_COLOR, CROWD_LABEL } from "@/lib/plan/display";
import { encodePlan } from "@/lib/plan/share";
import { nycToday, WEEKDAYS } from "@/lib/plan/time";
import type { DayPlan } from "@/lib/plan/types";
import { WEATHER_LABEL, weatherKind, type DayWeather, type Forecast } from "@/lib/plan/weatherCodes";
import { cn } from "@/lib/utils";
import { WeatherIcon } from "./WeatherIcon";

const DAYS = 14;
const OUTDOOR = new Set(["view", "park", "landmark", "neighborhood"]);

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

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

  // Keep the chosen day in view when the strip loads or the day changes.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll the strip only; scrollIntoView would also move the page.
    const el = strip.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && strip.current) strip.current.scrollTo({ left: el.offsetLeft - (strip.current.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
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
    <section aria-labelledby="days-heading" className="mt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="days-heading" className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarDays className="size-4 text-brand" aria-hidden /> Best day to go
        </h2>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground max-sm:hidden">
          {busy && <Loader2 className="size-3 animate-spin" aria-hidden />}
          Weather, crowds and closures for this plan
        </span>
      </div>
      <div ref={strip} className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pt-1 pb-2 [scrollbar-width:none]" role="group" aria-label="Choose a day">
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
              title={outcome?.closed.length ? `Closed: ${outcome.closed.join(", ")}` : undefined}
              className={cn(
                "relative flex w-[4.4rem] shrink-0 snap-start flex-col items-center rounded-2xl border px-1 pt-2 pb-2.5 transition",
                isSelected ? "border-foreground bg-foreground text-background shadow-lg" : "border-border bg-card hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md",
                isBest && !isSelected && "border-sev-b ring-2 ring-sev-b/25",
              )}
            >
              {isBest && (
                <span className="absolute -top-2 right-1.5 grid size-5 place-items-center rounded-full bg-sev-b text-on-color shadow" aria-label="Best day">
                  <Star className="size-3 fill-current" aria-hidden />
                </span>
              )}
              <span className={cn("text-[10px] font-semibold tracking-wide uppercase", isSelected ? "text-background/70" : "text-muted-foreground")}>
                {day === today ? "Today" : WEEKDAYS[d.getUTCDay()].slice(0, 3)}
              </span>
              <span className="font-display text-2xl leading-tight tabular-nums">{d.getUTCDate()}</span>
              <span className="flex h-5 items-center gap-0.5 text-[11px] tabular-nums">
                {w ? (
                  <>
                    <WeatherIcon code={w.code} className={cn("size-3.5", isSelected && "text-background")} />
                    {w.hi}°
                  </>
                ) : (
                  <span className={isSelected ? "text-background/60" : "text-muted-foreground"}>–</span>
                )}
              </span>
              <span className={cn("mt-1 h-1.5 w-10 overflow-hidden rounded-full", isSelected ? "bg-background/20" : "bg-muted")}>
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  band && <span className="block h-full rounded-full" style={{ width: `${Math.max(12, (outcome!.crowdLevel ?? 0) * 100)}%`, background: CROWD_COLOR[band] }} title={`${CROWD_LABEL[band]} on average`} />
                )}
              </span>
              {outcome && outcome.closed.length > 0 && (
                <span className={cn("mt-1 text-[9px] font-semibold uppercase", isSelected ? "text-background" : "text-sev-c")}>{outcome.closed.length} closed</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="min-h-5 text-xs leading-relaxed text-muted-foreground" aria-live="polite">
        {loading ? "Comparing the next two weeks…" : summary}
      </p>
    </section>
  );
}
