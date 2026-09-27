"use client";

import { useEffect, useState } from "react";
import { clock, isMealBreak, type DayPlan } from "../bridge/index";
import type { HomeMode, HomePlan } from "../core/gettingHome";
import type { Trip } from "../core/types";
import { AvatarBubble } from "./Avatar";

const MODES: { mode: HomeMode; icon: string; label: string }[] = [
  { mode: "subway", icon: "🚇", label: "Subway" },
  { mode: "bike", icon: "🚲", label: "E-bike" },
  { mode: "taxi", icon: "🚕", label: "Taxi" },
  { mode: "walk", icon: "🚶", label: "Walk" },
];

const money = (n: number) => (n === 0 ? "free" : n <= 3 ? `$${n.toFixed(2)}` : `~$${Math.round(n)}`);
const mins = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ""}` : `${n}m`);

export function GettingHomePanel({ trip, tripId, plan }: { trip: Trip; tripId: string; plan: DayPlan | null }) {
  const last = [...(plan?.stops ?? [])].reverse().find((s) => !isMealBreak(s)) ?? null;
  const starts = Object.entries(trip.members).filter(([, m]) => m.start);
  const query = last ? `lat=${last.lat}&lon=${last.lon}&at=${last.endMin}` : "";
  const startsKey = starts.map(([id, m]) => `${id}:${m.start!.lat},${m.start!.lon}`).join("|");
  const [result, setResult] = useState<{ key: string; home: ({ memberId: string } & HomePlan)[] } | null>(null);
  const key = `${query}#${startsKey}`;

  useEffect(() => {
    if (!query || !startsKey) return;
    const controller = new AbortController();
    fetch(`/api/trips/${tripId}/home?${query}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { home: [] }))
      .then((body: { home: ({ memberId: string } & HomePlan)[] }) => setResult({ key: `${query}#${startsKey}`, home: body.home }))
      .catch(() => {});
    return () => controller.abort();
  }, [tripId, query, startsKey]);

  if (!last || starts.length === 0) return null;
  const home = result?.key === key ? result.home : null;

  return (
    <section className="ed-panel">
      <div className="tr-home-header">
        <h2 className="ed-h3">Getting home</h2>
        <span className="tr-home-subtitle">
          from {last.name} at ~{clock(last.endMin)} · estimates
        </span>
      </div>
      {!home ? (
        <p className="tr-home-loading">Working out everyone&apos;s way home…</p>
      ) : (
        <div className="tr-home-scroll">
          <table className="tr-home-table">
            <thead>
              <tr>
                <th className="tr-home-who" />
                {MODES.map((m) => (
                  <th key={m.mode}>
                    {m.icon} {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {home.map((h) => {
                const member = trip.members[h.memberId];
                return (
                  <tr key={h.memberId}>
                    <td>{member && <AvatarBubble avatar={member.avatar} name={member.name} size="sm" />}</td>
                    {MODES.map((m) => {
                      const o = h.options.find((x) => x.mode === m.mode);
                      return (
                        <td key={m.mode}>
                          {o ? (
                            <span
                              className={`tr-home-mode ${h.best === m.mode ? "best" : ""} ${m.mode === "walk" && o.minutes > 45 ? "far-walk" : ""}`}
                            >
                              <b>{mins(o.minutes)}</b>
                              {money(o.cost)}
                            </span>
                          ) : (
                            <span className="tr-home-empty">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {home
            .filter((h) => h.warning)
            .map((h) => (
              <p key={h.memberId} className="tr-home-warning">
                ⚠ {trip.members[h.memberId]?.avatar.emoji} {h.warning}
              </p>
            ))}
          <p className="tr-home-note">
            Subway $3 · Citi Bike e-bike without membership $4.99 + $0.41/min · taxi meter before tip. Check live times before you go.
          </p>
        </div>
      )}
    </section>
  );
}
