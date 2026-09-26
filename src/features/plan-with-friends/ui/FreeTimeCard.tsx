"use client";

import { Clock } from "lucide-react";
import { useState } from "react";
import { clock } from "../bridge/index";
import type { FreeWindow, GroupWindow } from "../core/availability";

const STEPS = Array.from({ length: (27 - 6) * 2 + 1 }, (_, i) => 6 * 60 + i * 30);
const label = (m: number) => `${clock(m)}${m >= 24 * 60 ? " (next day)" : ""}`;

export function FreeTimeCard({ free, group, emoji, onSet }: { free: FreeWindow | null | undefined; group: GroupWindow | null; emoji: (id: string) => string; onSet: (w: FreeWindow | null) => void }) {
  const [from, setFrom] = useState(free?.from ?? 12 * 60);
  const [to, setTo] = useState(free?.to ?? 22 * 60);
  const [editing, setEditing] = useState(!free);
  const valid = to - from >= 60;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold">When are you free?</h2>
      </div>
      {free && !editing ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">
            {clock(free.from)} – {clock(free.to)}
          </span>
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">
            change
          </button>
          <button type="button" onClick={() => onSet(null)} className="text-xs text-muted-foreground hover:text-foreground">
            clear
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <select value={from} onChange={(e) => setFrom(Number(e.target.value))} aria-label="Free from" className="rounded-lg border border-border bg-background px-2 py-1.5">
            {STEPS.slice(0, -2).map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">to</span>
          <select value={to} onChange={(e) => setTo(Number(e.target.value))} aria-label="Free until" className="rounded-lg border border-border bg-background px-2 py-1.5">
            {STEPS.slice(2).map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              setEditing(false);
              onSet({ from, to });
            }}
            className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-40"
          >
            Save
          </button>
          {!valid && <span className="text-xs text-destructive">Pick at least an hour.</span>}
        </div>
      )}
      {group && (
        <p className="mt-2 text-xs text-muted-foreground">
          {group.everyone ? (
            <>Everyone&apos;s free {clock(group.from)} – {clock(group.to)}. The day fits in there.</>
          ) : (
            <>
              No time works for everyone. Planning {clock(group.from)} – {clock(group.to)}, which {group.missing.map(emoji).join(" ")} can&apos;t fully make.
            </>
          )}
        </p>
      )}
    </section>
  );
}
