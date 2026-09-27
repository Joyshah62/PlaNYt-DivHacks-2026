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
    <section aria-labelledby="group-heading" className="pl-group-trips">
      <div className="pl-group-heading">
        <h2 id="group-heading" className="pl-group-title pl-mono">
          <Users aria-hidden /> Your trip rooms
        </h2>
        <Link href="/start" className="pl-textbtn pl-mono">
          Start a trip room <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
      {trips && trips.length > 0 ? (
        <ul className="pl-group-list">
          {trips.slice(0, 5).map((t) => (
            <li key={t.id}>
              <Link href={`/trip/${t.id}`} className="pl-group-item">
                <span>
                  <span className="pl-group-name">{t.title}</span>
                  <span className="pl-small pl-muted">
                    {dayOf(t.date)} · {t.members} {t.members === 1 ? "person" : "people"}
                    {t.hosting ? " · you're hosting" : ""}
                  </span>
                </span>
                {t.decided ? (
                  <span className="pl-group-status decided">
                    <Check className="size-3" aria-hidden /> Decided
                  </span>
                ) : (
                  <span className="pl-group-status">Voting</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        trips && (
          <p className="pl-fine">
            Start a trip room, share the link, and everyone suggests places and votes. The day the group agrees on lands in each of your saved plans.
          </p>
        )
      )}
    </section>
  );
}
