"use client";

import { Check, Clock } from "lucide-react";
import Link from "next/link";
import { clock } from "../bridge/index";
import { Button, cn } from "../bridge/ui";
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
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`@keyframes roam-confetti{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(-70px) rotate(260deg);opacity:0}}`}</style>
      {bits.map((i) => (
        <span
          key={i}
          className="absolute bottom-2 block size-1.5 rounded-sm motion-reduce:hidden"
          style={{
            left: `${5 + i * 5.2}%`,
            background: ["#6d8dff", "#f0a44b", "#4fc28a", "#f27ab5", "#e8c547"][i % 5],
            animation: `roam-confetti ${0.9 + (i % 4) * 0.2}s ease-out ${(i % 6) * 0.08}s both`,
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
      <div className="relative flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl border border-emerald-500/40 bg-card px-4 py-3 shadow-lg">
        <Confetti />
        <AvatarStack people={people} />
        <p className="min-w-0 flex-1 text-sm">
          <strong>{c.reason === "majority-after-deadline" ? "Decided by majority 🎉" : "Everyone's in 🎉"}</strong>
          <span className="text-muted-foreground"> This is the day.</span>
        </p>
        <Link
          href={`/plan?plan=${trip.lockedCode}`}
          className="inline-flex h-8 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/85"
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
      <AvatarStack people={people} dimmed={c.pending} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">{status}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          {c.deadline ? (
            <>
              {c.deadlinePassed ? "Deadline passed · a majority is enough now" : `Decide by ${clock(new Date(c.deadline).getHours() * 60 + new Date(c.deadline).getMinutes())} · then a majority is enough`}
              {memberId && (
                <button type="button" className="ml-1 underline-offset-2 hover:underline" onClick={() => onDeadline(null)}>
                  clear
                </button>
              )}
            </>
          ) : memberId ? (
            <label className="flex items-center gap-1">
              Set a deadline:
              <select
                className="rounded-md border border-border bg-background px-1 py-0.5 text-xs"
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
        <Button
          onClick={() => onConfirm(!mine)}
          disabled={busy || (!mine && !hasDraft)}
          className={cn("h-9 rounded-full px-5 text-sm font-semibold", mine ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400" : "bg-foreground text-background hover:bg-foreground/85")}
        >
          {mine ? (
            <>
              <Check aria-hidden /> I&apos;m in
            </>
          ) : (
            "I'm in"
          )}
        </Button>
      )}
    </div>
  );
}
