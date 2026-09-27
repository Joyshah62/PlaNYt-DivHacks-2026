"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, MapPin, Star, UtensilsCrossed } from "lucide-react";
import { bestOutcome } from "@/lib/plan/choices";
import { CROWD_LABEL } from "@/lib/plan/display";
import { encodePlan } from "@/lib/plan/share";
import { Fold } from "./Fold";
import { clock, duration, WEEKDAYS } from "@/lib/plan/time";
import type { Choice, ChoiceOption, ChoiceOutcome, DayPlan } from "@/lib/plan/types";

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
  return (
    <span className="pl-photo block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="pl-photo-empty"><UtensilsCrossed aria-hidden /></span>}
      <span className="pl-tag pl-over">{option.why.split("·")[0].trim()}</span>
    </span>
  );
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
      <span className="pl-tag red">
        <AlertTriangle aria-hidden /> Closed on {WEEKDAYS[dow]}s
      </span>
    );
  }
  const delta = current ? outcome.travelMin - current.travelMin : 0;
  const over = current ? outcome.overMin - current.overMin : 0;
  return (
    <>
      {current && current.key !== outcome.key && (
        <span className={delta <= -2 ? "pl-tag red" : "pl-tag"}>{delta <= -2 ? `${duration(-delta)} less travel` : delta >= 2 ? `+${duration(delta)} travel` : "Same travel"}</span>
      )}
      {outcome.crowdBand && <span className="pl-tag">{CROWD_LABEL[outcome.crowdBand]}</span>}
      {over >= 5 && <span className="pl-tag red">Day runs {duration(over)} longer</span>}
      {outcome.issue && (
        <span className="pl-tag red">
          <AlertTriangle aria-hidden /> {outcome.issue === "late" ? "Misses its set time" : "Hours clash"}
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
  const Icon = choice.kind === "meal" ? UtensilsCrossed : MapPin;
  const foodTypes = useMemo(() => ["All nearby", ...new Set(choice.options.map((o) => o.why.split("·")[0].trim()).filter(Boolean))], [choice.options]);
  const visibleOptions = choice.kind === "meal" && foodFilter !== "All nearby" ? options.filter((o) => !o || o.why.split("·")[0].trim() === foodFilter) : options;

  const tags = (key: string | null, selected: boolean) => {
    const outcome = outcomeOf(key);
    return (
      <>
        {selected && <span className="pl-tag ink">In your plan</span>}
        {best && best.key === key && (
          <span className="pl-tag red">
            <Star aria-hidden /> Best fit
          </span>
        )}
        {outcome ? <Metrics outcome={outcome} current={current} dow={plan.dow} /> : !failed && <span className="pl-skeleton inline-block h-[1.6em] w-24" />}
      </>
    );
  };

  return (
    <section className="pl-choice" aria-label={`Options for ${choice.title}`}>
      <div className="pl-choice-head">
        <h3 className="pl-h3">
          <Icon className="mr-2 inline size-[0.7em] align-[0.05em] pl-red" aria-hidden />
          {choice.title}
          {choice.anchor?.near && <em className="pl-muted"> near {choice.anchor.near}</em>}
        </h3>
        {mealStop && <span className="pl-mono pl-muted shrink-0">Around {clock(mealStop.startMin)}</span>}
      </div>
      {choice.kind === "meal" ? (
        <>
          <div className="pl-chips scroll mt-3" role="group" aria-label="Filter nearby food">
            {foodTypes.map((type) => (
              <button key={type} type="button" aria-pressed={foodFilter === type} onClick={() => setFoodFilter(type)} className="pl-chip">
                {type}
              </button>
            ))}
          </div>
          <ul className="pl-reel">
            {visibleOptions.map((option) => {
              const key = option?.key ?? null;
              const selected = key === choice.currentKey;
              const outcome = outcomeOf(key);
              const noRoom = full && choice.currentKey === null && option !== null;
              return (
                <li key={key ?? "anywhere"}>
                  <button type="button" disabled={busy || selected || noRoom} aria-pressed={selected} onClick={() => onPick(choice, option)} className="pl-food">
                    {option ? (
                      <FoodPhoto option={option} />
                    ) : (
                      <span className="pl-photo block">
                        <span className="pl-photo-empty">
                          <MapPin aria-hidden />
                        </span>
                      </span>
                    )}
                    <span className="pl-food-body">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="pl-h3 line-clamp-1" style={{ fontSize: "1.15em" }}>
                          {option ? option.name : "Wherever you are"}
                        </span>
                        {outcome?.startMin != null && !outcome.closed && <span className="pl-mono pl-muted shrink-0">{clock(outcome.startMin)}</span>}
                      </span>
                      <span className="pl-small pl-muted italic">{option ? option.why : "Decide on the day. No detour, no booking."}</span>
                      <span className="mt-auto flex flex-wrap gap-1 pt-1">{tags(key, selected)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <ul className="pl-options">
          {visibleOptions.map((option) => {
            const key = option?.key ?? null;
            const selected = key === choice.currentKey;
            const outcome = outcomeOf(key);
            return (
              <li key={key ?? "anywhere"}>
                <button type="button" disabled={busy || selected} aria-pressed={selected} onClick={() => onPick(choice, option)} className="pl-option">
                  <span className="pl-radio" aria-hidden />
                  <span className="pl-option-name">{option ? option.name : "Wherever you are then"}</span>
                  {outcome?.startMin != null && !outcome.closed ? <span className="pl-mono pl-muted">{clock(outcome.startMin)}</span> : <span />}
                  <span className="pl-option-why">{option ? option.why : "Decide on the day. No detour, no booking."}</span>
                  <span className="pl-option-tags">{tags(key, selected)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {failed && <p className="pl-small pl-muted mt-2">Couldn&apos;t compare these right now. You can still pick one.</p>}
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
  const names = choices.map((c) => c.title.toLowerCase());
  return (
    <Fold
      kicker="Your call"
      title={<>Make it <em>yours</em></>}
      summary={names.length ? `Options for ${names.join(" and ")}, each tried in your whole day.` : "Looking for places to eat along your route…"}
    >
      <p className="pl-dek mt-0 mb-5">Pick one and the day re-plans around it.</p>
      {choices.map((c) => (
        <ChoiceGroup key={c.id} plan={plan} choice={c} busy={busy} full={full} onPick={onPick} />
      ))}
      {loadingMeals && <div className="pl-skeleton mt-4 h-40 w-full" />}
    </Fold>
  );
}
