"use client";

import dynamic from "next/dynamic";
import { isMealBreak, type DayPlan, type StopInput } from "../bridge/index";
import { MEETUP_PREFIX } from "../core/fairness";
import type { Trip } from "../core/types";
import type { MapPerson, MapStop } from "./RoomMap";

// MapLibre needs WebGL and window, so the map only loads in the browser.
const RoomMap = dynamic(() => import("./RoomMap"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted" /> });

export function GroupMapPanel({ trip, plan, memberId, onSuggest }: { trip: Trip; plan: DayPlan | null; memberId: string | null; onSuggest: (stop: StopInput) => void }) {
  const people: MapPerson[] = Object.entries(trip.members).flatMap(([id, m]) => (m.start ? [{ id, name: m.name, avatar: m.avatar, lat: m.start.lat, lon: m.start.lon }] : []));
  const stops: MapStop[] = (plan?.stops ?? trip.draft?.stops ?? []).filter((s) => !("meal" in s) || !isMealBreak(s as never)).map((s) => ({ key: s.key, name: s.name, lat: s.lat, lon: s.lon }));
  const f = trip.fairness;
  const origin = trip.draft?.origin ?? null;
  const meetupChosen = trip.candidates.some((c) => c.stop.key.startsWith(MEETUP_PREFIX));
  const emoji = (id: string) => trip.members[id]?.avatar.emoji ?? "?";
  const times = (per: Record<string, number>) =>
    Object.entries(per)
      .sort((a, b) => a[1] - b[1])
      .map(([id, m]) => `${emoji(id)} ${m}m`)
      .join(" · ");

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative h-64 sm:h-72">
        <RoomMap people={people} stops={stops} origin={origin} />
        {people.length === 0 && (
          <div className="pointer-events-none absolute inset-x-3 top-3 rounded-xl bg-card/90 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
            Add where you&apos;re starting from to see everyone on the map and get a start that&apos;s fair for all.
          </div>
        )}
      </div>
      {f && (
        <div className="flex flex-col gap-2 border-t border-border p-3 text-sm">
          {f.firstStop && !meetupChosen && (
            <p>
              <span className="font-semibold text-brand">★ Fairest start: {f.firstStop.name}</span>
              <span className="text-muted-foreground">
                {" "}
                · everyone arrives within {f.firstStop.worst} min
                <span className="block text-xs">{times(f.firstStop.perMember)}</span>
              </span>
            </p>
          )}
          {meetupChosen && origin && <p className="font-semibold text-brand">★ {origin.label} first, then the day</p>}
          {f.meetup && !meetupChosen && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs">
              <span className="min-w-0 flex-1">
                Or meet at a station first: <b>{f.meetup.name.replace(/^Meet at /, "")}</b>, everyone within {f.meetup.worst} min ({times(f.meetup.perMember)})
              </span>
              {memberId && !trip.lockedCode && (
                <button
                  type="button"
                  onClick={() => onSuggest({ key: f.meetup!.key, name: f.meetup!.name, lat: f.meetup!.lat, lon: f.meetup!.lon, visitMin: 10, attractionId: null })}
                  className="rounded-full bg-foreground px-3 py-1 font-medium text-background"
                >
                  Suggest it
                </button>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            {f.starts} of {Object.keys(trip.members).length} shared a starting point. Times are subway or walking estimates.
          </p>
        </div>
      )}
    </section>
  );
}
