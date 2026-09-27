"use client";

import { useState } from "react";
import { clock } from "../bridge/index";
import type { FreeWindow, GroupWindow } from "../core/availability";
import { AvatarBubble } from "./Avatar";
import { OverlapClock, type ClockPerson } from "./OverlapClock";
import { TimeRangeSlider } from "./TimeRangeSlider";

const MIN = 6 * 60;
const MAX = 27 * 60;

export function FreeTimeCard({ meId, people, group, onSet }: { meId: string; people: ClockPerson[]; group: GroupWindow | null; onSet: (w: FreeWindow | null) => void }) {
  const mine = people.find((p) => p.id === meId)?.free ?? null;
  const [draft, setDraft] = useState<FreeWindow>(mine ?? { from: 12 * 60, to: 22 * 60 });
  const value = mine && draft.from === mine.from && draft.to === mine.to ? mine : draft;
  const blocking = group && !group.everyone ? group.missing.map((id) => people.find((p) => p.id === id)).filter((p) => !!p) : [];
  const notSet = people.filter((p) => !p.free);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">When are you free?</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {mine ? `${clock(value.from)} – ${clock(value.to)}` : "not set"}
          {mine && (
            <button type="button" onClick={() => onSet(null)} className="ml-2 hover:text-foreground">
              clear
            </button>
          )}
        </span>
      </div>
      <TimeRangeSlider min={MIN} max={MAX} value={value} onChange={setDraft} onCommit={(v) => onSet(v)} />
      {!mine && <p className="text-xs text-muted-foreground">Drag the handles to your free time. It saves when you let go.</p>}

      <p className="mt-2 text-sm">
        {group ? (
          group.everyone ? (
            <>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Group overlap:</span> {clock(group.from)} – {clock(group.to)}
            </>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              No time works for everyone yet. Blocking it: {blocking.map((p) => `${p.avatar.emoji} ${p.name}`).join(", ")}. Planning {clock(group.from)} – {clock(group.to)} for the rest.
            </span>
          )
        ) : (
          <span className="text-muted-foreground">Nobody has set their time yet.</span>
        )}
      </p>
      <OverlapClock people={people} group={group} />
      {notSet.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {notSet.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1">
              <AvatarBubble avatar={p.avatar} name={p.name} size="sm" /> not set
            </span>
          ))}
          <span>· left out until they add a time</span>
        </div>
      )}
    </section>
  );
}
