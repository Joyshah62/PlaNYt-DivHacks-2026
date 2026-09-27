"use client";

import { useEffect, useState } from "react";
import { ExternalLink, TicketCheck, TrainFront, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { money, partyTotal, type DayBudget } from "@/lib/plan/budget";
import type { PlanRequest } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

/** Party sizes offered to pick from; the budget is per person until one is known. */
const PARTY = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * What the day costs: each stop's ticket or typical spend, meals and subway
 * fares, per person and for everyone going. Prices are looked up on the web
 * the first time a place appears, so the card fills in after the itinerary
 * rather than holding it up.
 */
export function Budget({ request, people, onPeople }: {
  request: PlanRequest;
  /** How many are going; null until known. */
  people: number | null;
  onPeople: (people: number) => void;
}) {
  const [picking, setPicking] = useState(false);
  const key = JSON.stringify(request);
  const [result, setResult] = useState<{ key: string; budget: DayBudget | null } | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/budget", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request: JSON.parse(key) }), signal: abort.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((budget: DayBudget | null) => setResult({ key, budget }))
      .catch(() => {
        if (!abort.signal.aborted) setResult({ key, budget: null });
      });
    return () => abort.abort();
  }, [key]);

  const budget = result?.key === key ? result.budget : undefined;
  if (budget === null) return null;
  const booking = budget?.lines.filter((l) => l.bookAhead) ?? [];

  return (
    <section aria-labelledby="budget-heading" className="mt-5 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 id="budget-heading" className="flex items-center gap-1.5 text-sm font-semibold">
          <Wallet className="size-4 text-brand" aria-hidden /> Your day&apos;s budget
        </h2>
        {budget ? (
          <p className="text-right">
            <span className="font-display text-2xl leading-none">About ${people ? partyTotal(budget, people) : budget.perPerson}</span>
            <span className="block text-[11px] text-muted-foreground">
              {people === null ? "per person" : people === 1 ? "for one person" : `for ${people} people · $${budget.perPerson} per person`}
            </span>
          </p>
        ) : (
          <Skeleton className="h-8 w-28 rounded-lg" />
        )}
      </div>

      {!budget ? (
        <div className="mt-3 space-y-2" role="status" aria-label="Looking up prices">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <p className="text-[11px] text-muted-foreground">Checking ticket prices…</p>
        </div>
      ) : (
        <>
          {people === null || picking ? (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium">{people === null ? "How many of you? For a total for everyone:" : "How many of you?"}</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="How many of you">
                {PARTY.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={people === n}
                    onClick={() => {
                      onPeople(n);
                      setPicking(false);
                    }}
                    className="min-w-8 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium tabular-nums transition hover:border-brand aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-on-color"
                  >
                    {n === PARTY.length ? `${n}+` : n}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setPicking(true)} className="mt-1 text-[11px] font-medium text-brand underline-offset-2 hover:underline">
              Not {people === 1 ? "just you" : `${people} of you`}? Change
            </button>
          )}
          {booking.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-sev-a-soft px-2.5 py-1.5 text-xs font-medium text-sev-a">
              <TicketCheck className="mt-px size-3.5 shrink-0" aria-hidden />
              Book ahead: {booking.map((l) => l.name).join(", ")}. Timed tickets can sell out.
            </p>
          )}
          <ul className="mt-3 divide-y divide-border text-sm">
            {budget.lines.map((l) => (
              <li key={l.key} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{l.name}</span>
                  {(l.note || l.url) && (
                    <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      {l.note}
                      {l.url && (
                        <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground">
                          {l.bookAhead ? "Book" : "Source"}
                          <ExternalLink className="size-2.5" aria-hidden />
                          <span className="sr-only"> for {l.name}</span>
                        </a>
                      )}
                    </span>
                  )}
                </span>
                <span className={cn("shrink-0 tabular-nums", l.basis === "free" ? "text-brand" : l.basis === "unknown" ? "text-xs text-muted-foreground" : "font-medium")}>{money(l)}</span>
              </li>
            ))}
            {(budget.transit.rides > 0 || budget.transit.note) && (
              <li className="flex items-start justify-between gap-3 py-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <TrainFront className="size-3.5 text-muted-foreground" aria-hidden />
                  {budget.transit.rides > 0 ? `Subway · ${budget.transit.rides} ${budget.transit.rides === 1 ? "trip" : "trips"} × $${budget.transit.fare.toFixed(2)} each` : budget.transit.note}
                </span>
                {budget.transit.rides > 0 && <span className="shrink-0 font-medium tabular-nums">${budget.transit.total}</span>}
              </li>
            )}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Adult prices found on the web (see links), per person; ~ marks a typical estimate.{people && people > 1 ? " Children's tickets are often cheaper." : ""}{budget.unknown ? ` ${budget.unknown} ${budget.unknown === 1 ? "price" : "prices"} couldn't be found and ${budget.unknown === 1 ? "isn't" : "aren't"} counted.` : ""} Check before you go.
          </p>
        </>
      )}
    </section>
  );
}
