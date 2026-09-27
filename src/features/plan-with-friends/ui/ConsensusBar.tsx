"use client";

import { Check, Clock } from "lucide-react";
import Link from "next/link";
import { clock } from "../bridge/index";
import type { Trip } from "../core/types";
import { AvatarStack } from "./Avatar";

function deadlineOptions(now: Date): { label: string; at: number }[] {
  const at = (h: number, m = 0, dayOffset = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const opts = [
    { label: "In 1 hour", at: now.getTime() + 3600_000 },
    { label: "In 3 hours", at: now.getTime() + 3 * 3600_000 },
    { label: "Tonight 8pm", at: at(20) },
    { label: "Tomorrow noon", at: at(12, 0, 1) },
  ];
  return opts.filter((o) => o.at > now.getTime());
}

function Confetti() {
  const bits = Array.from({ length: 18 }, (_, i) => i);
  return (
    <span aria-hidden className="tr-confetti">
      {bits.map((i) => (
        <span
          key={i}
          className="tr-confetti-bit"
          style={{
            left: `${5 + i * 5.2}%`,
            background: i % 3 ? "var(--ink)" : "var(--red)",
            animationDuration: `${0.9 + (i % 4) * 0.2}s`,
            animationDelay: `${(i % 6) * 0.08}s`,
          }}
        />
      ))}
    </span>
  );
}

export function ConsensusBar({
  trip,
  memberId,
  hasDraft,
  busy,
  onConfirm,
  onDeadline,
}: {
  trip: Trip;
  memberId: string | null;
  hasDraft: boolean;
  busy: boolean;
  onConfirm: (on: boolean) => void;
  onDeadline: (at: number | null) => void;
}) {
  const c = trip.consensus;
  const people = Object.entries(trip.members)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt)
    .map(([id, m]) => ({ id, ...m }));
  const mine = !!memberId && c.confirmed.includes(memberId);
  const staleMine = !!memberId && c.stale.includes(memberId);
  const waitingOn = c.pending.map((id) => trip.members[id]?.avatar.emoji).filter(Boolean).join(" ");

  if (trip.lockedCode) {
    return (
      <div className="tr-consensus tr-consensus-locked">
        <Confetti />
        <AvatarStack people={people} />
        <p className="tr-consensus-content tr-consensus-status">
          <strong>{c.reason === "majority-after-deadline" ? "Decided by majority 🎉" : "Everyone's in 🎉"}</strong>
          <span className="ed-muted"> This is the day.</span>
        </p>
        <Link
          href={`/plan?plan=${trip.lockedCode}`}
          className="ed-btn ed-small"
        >
          Open in planner →
        </Link>
      </div>
    );
  }

  const status = !hasDraft
    ? "Vote for a place first."
    : c.total === 1
      ? "You're the only one here. Invite friends, or tap I'm in to lock it yourself."
      : staleMine
        ? "The day changed. Tap I'm in again."
        : `${c.confirmed.length} of ${c.total} are in${waitingOn ? ` · waiting on ${waitingOn}` : ""}`;

  return (
    <div className="tr-consensus">
      <AvatarStack people={people} dimmed={c.pending} />
      <div className="tr-consensus-content">
        <p className="tr-consensus-status">{status}</p>
        <p className="tr-consensus-deadline">
          <Clock className="size-3" aria-hidden />
          {c.deadline ? (
            <>
              {c.deadlinePassed ? "Deadline passed · a majority is enough now" : `Decide by ${clock(new Date(c.deadline).getHours() * 60 + new Date(c.deadline).getMinutes())} · then a majority is enough`}
              {memberId && (
                <button type="button" className="tr-consensus-deadline-clear" onClick={() => onDeadline(null)}>
                  clear
                </button>
              )}
            </>
          ) : memberId ? (
            <label className="tr-consensus-deadline-picker">
              Set a deadline:
              <select
                className="tr-consensus-deadline-select"
                value=""
                onChange={(e) => e.target.value && onDeadline(Number(e.target.value))}
                aria-label="Set a deadline"
              >
                <option value="">none</option>
                {deadlineOptions(new Date()).map((o) => (
                  <option key={o.label} value={o.at}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            "No deadline"
          )}
        </p>
      </div>
      {memberId && (
        <button
          type="button"
          onClick={() => onConfirm(!mine)}
          disabled={busy || (!mine && !hasDraft)}
          className={`tr-in ${mine ? "on" : ""}`}
        >
          {mine ? (
            <>
              <Check className="size-4" aria-hidden /> I&apos;m in
            </>
          ) : (
            "I'm in"
          )}
        </button>
      )}
    </div>
  );
}
