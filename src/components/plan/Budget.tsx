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
  const [requested, setRequested] = useState(false);
  const key = JSON.stringify(request);
  const [result, setResult] = useState<{ key: string; budget: DayBudget | null } | null>(null);

  useEffect(() => {
    if (!requested) return;
    const abort = new AbortController();
    fetch("/api/budget", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request: JSON.parse(key) }), signal: abort.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((budget: DayBudget | null) => setResult({ key, budget }))
      .catch(() => {
        if (!abort.signal.aborted) setResult({ key, budget: null });
      });
    return () => abort.abort();
  }, [key, requested]);

  if (!requested) return <section className="pl-budget">
    <p className="pl-small pl-muted">Typical costs for tickets, meals and subway rides. Nothing is booked.</p>
    <button type="button" onClick={() => setRequested(true)} className="ed-btn ed-btn--ghost mt-2">Estimate costs</button>
  </section>;

  const budget = result?.key === key ? result.budget : undefined;
  if (budget === null) return null;
  const booking = budget?.lines.filter((l) => l.bookAhead) ?? [];

  return (
    <section aria-labelledby="budget-heading" className="pl-budget">
      <div className="pl-budget-head">
        <h2 id="budget-heading" className="pl-budget-title pl-mono">
          <Wallet aria-hidden /> Estimated costs
        </h2>
        {budget ? (
          <p className="pl-budget-total">
            <strong>About ${people ? partyTotal(budget, people) : budget.perPerson}</strong>
            <span className="pl-small pl-muted">
              {people === null ? "per person" : people === 1 ? "for one person" : `for ${people} people · $${budget.perPerson} per person`}
            </span>
          </p>
        ) : (
          <Skeleton className="h-8 w-28 rounded-none" />
        )}
      </div>

      {!budget ? (
        <div className="pl-budget-loading" role="status" aria-label="Looking up prices">
          <Skeleton className="h-4 w-full rounded-none" />
          <Skeleton className="h-4 w-4/5 rounded-none" />
          <Skeleton className="h-4 w-3/5 rounded-none" />
          <p className="pl-small pl-muted">Checking ticket prices…</p>
        </div>
      ) : (
        <>
          {people === null || picking ? (
            <div className="pl-budget-people">
              <p className="pl-small">{people === null ? "How many of you? For a total for everyone:" : "How many of you?"}</p>
              <div role="group" aria-label="How many of you">
                {PARTY.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={people === n}
                    onClick={() => {
                      onPeople(n);
                      setPicking(false);
                    }}
                    className="pl-budget-person"
                  >
                    {n === PARTY.length ? `${n}+` : n}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setPicking(true)} className="pl-textbtn pl-small">
              Not {people === 1 ? "just you" : `${people} of you`}? Change
            </button>
          )}
          {booking.length > 0 && (
            <p className="pl-budget-booking">
              <TicketCheck aria-hidden />
              Book ahead: {booking.map((l) => l.name).join(", ")}. Timed tickets can sell out.
            </p>
          )}
          <ul className="pl-budget-lines">
            {budget.lines.map((l) => (
              <li key={l.key}>
                <span className="min-w-0">
                  <span className="pl-budget-name">{l.name}</span>
                  {(l.note || l.url) && (
                    <span className="pl-budget-source pl-small pl-muted">
                      {l.note}
                      {l.url && (
                        <a href={l.url} target="_blank" rel="noreferrer" className="pl-link">
                          {l.bookAhead ? "Book" : "Source"}
                          <ExternalLink className="size-2.5" aria-hidden />
                          <span className="sr-only"> for {l.name}</span>
                        </a>
                      )}
                    </span>
                  )}
                </span>
                <span className={cn("pl-budget-value", l.basis === "free" ? "pl-red" : l.basis === "unknown" ? "pl-muted" : "")}>{money(l)}</span>
              </li>
            ))}
            {(budget.transit.rides > 0 || budget.transit.note) && (
              <li>
                <span className="pl-budget-name">
                  <TrainFront aria-hidden />
                  {budget.transit.rides > 0 ? `Subway · ${budget.transit.rides} ${budget.transit.rides === 1 ? "trip" : "trips"} × $${budget.transit.fare.toFixed(2)} each` : budget.transit.note}
                </span>
                {budget.transit.rides > 0 && <span className="pl-budget-value">${budget.transit.total}</span>}
              </li>
            )}
          </ul>
          <p className="pl-fine">
            Adult prices found on the web (see links), per person; ~ marks a typical estimate.{people && people > 1 ? " Children's tickets are often cheaper." : ""}{budget.unknown ? ` ${budget.unknown} ${budget.unknown === 1 ? "price" : "prices"} couldn't be found and ${budget.unknown === 1 ? "isn't" : "aren't"} counted.` : ""} Check before you go.
          </p>
        </>
      )}
    </section>
  );
}
