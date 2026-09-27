"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Users } from "lucide-react";
import type { TripSummary } from "@/features/plan-with-friends/server/service";

const dayOf = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** The trip rooms this account is in (kept in MongoDB, so they're here on every device), and a way to start one. */
export function GroupTrips() {
  const [trips, setTrips] = useState<TripSummary[] | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/trips/mine", { signal: abort.signal })
      .then((res) => (res.ok ? res.json() : { trips: [] }))
      .then((body: { trips?: TripSummary[] }) => setTrips(body.trips ?? []))
      .catch(() => {
        if (!abort.signal.aborted) setTrips([]);
      });
    return () => abort.abort();
  }, []);

  return (
    <section aria-labelledby="group-heading">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="group-heading" className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="size-4 text-brand" aria-hidden /> Plan with friends
        </h2>
        <Link href="/start" className="inline-flex items-center gap-1 text-xs font-medium text-brand underline-offset-4 hover:underline">
          Start a trip room <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
      {trips && trips.length > 0 ? (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {trips.slice(0, 5).map((t) => (
            <li key={t.id}>
              <Link href={`/trip/${t.id}`} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-muted/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {dayOf(t.date)} · {t.members} {t.members === 1 ? "person" : "people"}
                    {t.hosting ? " · you're hosting" : ""}
                  </span>
                </span>
                {t.decided ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                    <Check className="size-3" aria-hidden /> Decided
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Voting</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        trips && (
          <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Start a trip room, share the link, and everyone suggests places and votes. The day the group agrees on lands in each of your saved plans.
          </p>
        )
      )}
    </section>
  );
}
