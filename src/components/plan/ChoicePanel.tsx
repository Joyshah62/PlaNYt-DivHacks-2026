"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, MapPin, Sparkles, Star, UtensilsCrossed, ArrowRight, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { bestOutcome } from "@/lib/plan/choices";
import { CROWD_COLOR, CROWD_LABEL } from "@/lib/plan/display";
import { encodePlan } from "@/lib/plan/share";
import { clock, duration, WEEKDAYS } from "@/lib/plan/time";
import type { Choice, ChoiceOption, ChoiceOutcome, DayPlan } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

/** The options a slot is compared across: a meal can also go back to "wherever you are". */
function slotOptions(choice: Choice): (ChoiceOption | null)[] {
  return choice.kind === "meal" ? [...choice.options, null] : choice.options;
}

function FoodPhoto({ option }: { option: ChoiceOption }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ name: option.name, lat: String(option.lat), lon: String(option.lon) });
    fetch(`/api/photo?${params}`).then((res) => res.ok ? res.json() as Promise<{ url?: string }> : null).then((photo) => {
      if (!cancelled) setUrl(photo?.url ?? null);
    }).catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; };
  }, [option.key, option.name, option.lat, option.lon]);
  return <div className="relative h-32 overflow-hidden bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 dark:from-amber-950/60 dark:via-orange-950/40 dark:to-rose-950/50">
    {url && <img src={url} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />}
    <span className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur">{option.why.split("·")[0].trim()}</span>
  </div>;
}

/** Re-plans the day with each option and keeps the outcomes for the plan they were made for. */
function useOutcomes(plan: DayPlan, choice: Choice) {
  const options = slotOptions(choice);
  const id = `${encodePlan(plan.request)}|${choice.currentKey}|${options.map((o) => o?.key ?? "-").join(",")}`;
  const [state, setState] = useState<{ id: string; outcomes: ChoiceOutcome[] | null; failed: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const optionsNow = slotOptions(choice);
    fetch("/api/plan/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: plan.request, slot: choice.currentKey, options: optionsNow }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        if (!cancelled) setState({ id, outcomes: body.outcomes as ChoiceOutcome[], failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ id, outcomes: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
    // `id` captures everything the comparison depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return state?.id === id ? state : { outcomes: null, failed: false };
}

function Metrics({ outcome, current, dow }: { outcome: ChoiceOutcome; current: ChoiceOutcome | undefined; dow: number }) {
  if (outcome.closed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sev-c-soft px-2 py-0.5 text-[11px] font-medium text-sev-c">
        <AlertTriangle className="size-3" aria-hidden /> Closed on {WEEKDAYS[dow]}s
      </span>
    );
  }
  const delta = current ? outcome.travelMin - current.travelMin : 0;
  const over = current ? outcome.overMin - current.overMin : 0;
  return (
    <>
      {current && current.key !== outcome.key && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
            delta <= -2 ? "bg-brand-soft text-brand" : delta >= 2 ? "bg-muted text-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {delta <= -2 ? `${duration(-delta)} less travel` : delta >= 2 ? `+${duration(delta)} travel` : "Same travel"}
        </span>
      )}
      {outcome.crowdBand && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
          <span className="size-1.5 rounded-full" style={{ background: CROWD_COLOR[outcome.crowdBand] }} aria-hidden />
          {CROWD_LABEL[outcome.crowdBand]}
        </span>
      )}
      {over >= 5 && <span className="rounded-full bg-sev-c-soft px-2 py-0.5 text-[11px] font-medium text-sev-c">Day runs {duration(over)} longer</span>}
      {outcome.issue && (
        <span className="inline-flex items-center gap-1 rounded-full bg-sev-c-soft px-2 py-0.5 text-[11px] font-medium text-sev-c">
          <AlertTriangle className="size-3" aria-hidden /> {outcome.issue === "late" ? "Misses its set time" : "Hours clash"}
        </span>
      )}
    </>
  );
}

function ChoiceGroup({
  plan,
  choice,
  busy,
  full,
  onPick,
}: {
  plan: DayPlan;
  choice: Choice;
  busy: boolean;
  full: boolean;
  onPick: (choice: Choice, option: ChoiceOption | null) => void;
}) {
  const { outcomes, failed } = useOutcomes(plan, choice);
  const [foodFilter, setFoodFilter] = useState("All nearby");
  const options = slotOptions(choice);
  const outcomeOf = (key: string | null) => outcomes?.find((o) => o.key === key);
  const current = outcomeOf(choice.currentKey);
  // "Wherever you are" never costs a detour, so it would always win; compare real places.
  const best = outcomes ? bestOutcome(outcomes.filter((o) => o.key !== null)) : null;
  const mealStop = choice.meal ? plan.stops.find((s) => s.meal === choice.meal) : undefined;
  const Icon = choice.kind === "meal" ? UtensilsCrossed : Sparkles;
  const foodTypes = useMemo(() => ["All nearby", ...new Set(choice.options.map((o) => o.why.split("·")[0].trim()).filter(Boolean))], [choice.options]);
  const visibleOptions = choice.kind === "meal" && foodFilter !== "All nearby" ? options.filter((o) => !o || o.why.split("·")[0].trim() === foodFilter) : options;

  return (
    <section className={`rounded-2xl border border-border bg-card p-3 ${choice.kind === "meal" ? "overflow-hidden" : ""}`} aria-label={`Options for ${choice.title}`}>
      <h3 className="flex items-baseline gap-2 px-1 pb-2 text-sm font-semibold">
        <Icon className="size-3.5 shrink-0 translate-y-0.5 text-brand" aria-hidden />
        <span>
          {choice.title}
          {choice.anchor?.near && <span className="font-normal text-muted-foreground"> near {choice.anchor.near}</span>}
        </span>
        {mealStop && <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">around {clock(mealStop.startMin)}</span>}
      </h3>
      {choice.kind === "meal" && <>
        <p className="px-1 pb-3 text-xs leading-relaxed text-muted-foreground">Pick a bite near your route. Swipe to browse, then see how each option changes your day.</p>
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Filter nearby food">
          {foodTypes.map((type) => <button key={type} type="button" aria-pressed={foodFilter === type} onClick={() => setFoodFilter(type)} className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${foodFilter === type ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{type}</button>)}
        </div>
      </>}
      {choice.kind === "meal" && <div className="mb-2 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground"><ArrowLeft className="size-3" aria-hidden /> Swipe to explore <ArrowRight className="size-3" aria-hidden /></div>}
      <ul className={choice.kind === "meal" ? "-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 [scrollbar-width:thin]" : "space-y-1.5"}>
        {visibleOptions.map((option) => {
          const key = option?.key ?? null;
          const selected = key === choice.currentKey;
          const outcome = outcomeOf(key);
          // A meal picked on top of a full day has no room; a swap never adds a stop.
          const noRoom = full && choice.currentKey === null && option !== null;
          return (
            <li key={key ?? "anywhere"}>
              <button
                type="button"
                disabled={busy || selected || noRoom}
                aria-pressed={selected}
                onClick={() => onPick(choice, option)}
                className={cn(
                  choice.kind === "meal" ? "group flex h-full w-[235px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border text-left transition" : "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                  selected ? "border-brand bg-brand-soft/60" : "border-transparent bg-muted/40 hover:border-foreground/15 hover:bg-muted/70",
                  (busy || noRoom) && !selected && "cursor-not-allowed opacity-60",
                )}
              >
                {choice.kind === "meal" && option && <FoodPhoto option={option} />}
                {choice.kind === "meal" && !option && <div className="grid h-20 w-full place-items-center bg-muted text-xs text-muted-foreground"><UtensilsCrossed className="size-5" aria-hidden /></div>}
                {choice.kind !== "meal" && <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                    selected ? "border-brand bg-brand text-on-color" : "border-foreground/25 bg-background",
                  )}
                  aria-hidden
                >
                  {selected && <Check className="size-3" />}
                </span>}
                <span className={cn("min-w-0 flex-1", choice.kind === "meal" && "w-full p-3")}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("text-sm font-semibold", choice.kind === "meal" ? "line-clamp-1" : "truncate")}>{option ? option.name : "Wherever you are then"}</span>
                    {outcome?.startMin != null && !outcome.closed && (
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{clock(outcome.startMin)}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {option ? option.why : "Decide on the day. No detour, no booking."}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {selected && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-on-color">In your plan</span>}
                    {best && best.key === key && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sev-b-soft px-2 py-0.5 text-[11px] font-medium text-sev-b">
                        <Star className="size-3" aria-hidden /> Best fit for your day
                      </span>
                    )}
                    {outcome ? (
                      <Metrics outcome={outcome} current={current} dow={plan.dow} />
                    ) : (
                      !failed && <Skeleton className="h-4 w-28 rounded-full" />
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {failed && <p className="px-1 pt-2 text-xs text-muted-foreground">Couldn&apos;t compare these right now. You can still pick one.</p>}
    </section>
  );
}

/**
 * Slots in the day that could go more than one way - a vague wish the assistant
 * filled, a meal - each with its options and what picking it does to the day.
 */
export function ChoicePanel({
  plan,
  choices,
  busy,
  full,
  loadingMeals,
  onPick,
}: {
  plan: DayPlan;
  choices: Choice[];
  busy: boolean;
  full: boolean;
  loadingMeals: boolean;
  onPick: (choice: Choice, option: ChoiceOption | null) => void;
}) {
  if (!choices.length && !loadingMeals) return null;
  return (
    <div className="mt-5">
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <MapPin className="size-4 text-brand" aria-hidden /> Make it yours
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">We tried each option in your whole day. Pick one and the day re-plans around it.</p>
      <div className="space-y-3">
        {choices.map((c) => (
          <ChoiceGroup key={c.id} plan={plan} choice={c} busy={busy} full={full} onPick={onPick} />
        ))}
        {loadingMeals && <Skeleton className="h-24 w-full rounded-2xl" />}
      </div>
    </div>
  );
}
