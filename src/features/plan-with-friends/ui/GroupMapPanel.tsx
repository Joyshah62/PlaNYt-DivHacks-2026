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
    <section className="ed-panel">
      <div className="tr-map-container">
        <RoomMap people={people} stops={stops} origin={origin} />
      </div>
      {f && (
        <div className="tr-map-info">
          {f.firstStop && !meetupChosen && (
            <p>
              <span className="tr-map-fairest">★ Fairest start: {f.firstStop.name}</span>
              <span className="tr-map-fairest-detail">
                {" "}
                · everyone arrives within {f.firstStop.worst} min<br />{times(f.firstStop.perMember)}
              </span>
            </p>
          )}
          {meetupChosen && origin && <p className="tr-map-fairest">★ {origin.label} first, then the day</p>}
          {f.meetup && !meetupChosen && (
            <div className="tr-map-meetup">
              <span className="tr-map-meetup-text">
                Or meet at a station first: <b>{f.meetup.name.replace(/^Meet at /, "")}</b>, everyone within {f.meetup.worst} min ({times(f.meetup.perMember)})
              </span>
              {memberId && !trip.lockedCode && (
                <button
                  type="button"
                  onClick={() => onSuggest({ key: f.meetup!.key, name: f.meetup!.name, lat: f.meetup!.lat, lon: f.meetup!.lon, visitMin: 10, attractionId: null })}
                  className="ed-btn ed-small"
                >
                  Suggest it
                </button>
              )}
            </div>
          )}
          <p className="tr-map-note">
            {f.starts} of {Object.keys(trip.members).length} shared a starting point. Times are subway or walking estimates.
          </p>
        </div>
      )}
    </section>
  );
}
