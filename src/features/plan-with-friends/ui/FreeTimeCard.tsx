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
    <section className="ed-panel">
      <div className="tr-panel-head">
        <h2 className="ed-h3">When are you free?</h2>
        <span className="ed-mono ed-muted tr-nums">
          {mine ? `${clock(value.from)} – ${clock(value.to)}` : "not set"}
          {mine && (
            <>
              {" · "}
              <button type="button" onClick={() => onSet(null)} className="ed-link">
                clear
              </button>
            </>
          )}
        </span>
      </div>
      <TimeRangeSlider min={MIN} max={MAX} value={value} onChange={setDraft} onCommit={(v) => onSet(v)} />
      {!mine && <p className="ed-small ed-muted">Drag the handles to your free time. It saves when you let go.</p>}

      <p className="ed-small tr-gap">
        {group ? (
          group.everyone ? (
            <>
              <b>Group overlap:</b> {clock(group.from)} – {clock(group.to)}
            </>
          ) : (
            <span className="tr-warn">
              No time works for everyone yet. Blocking it: {blocking.map((p) => `${p.avatar.emoji} ${p.name}`).join(", ")}. Planning {clock(group.from)} – {clock(group.to)} for the rest.
            </span>
          )
        ) : (
          <span className="ed-muted">Nobody has set their time yet.</span>
        )}
      </p>
      <OverlapClock people={people} group={group} />
      {notSet.length > 0 && (
        <div className="tr-row tr-gap ed-small ed-muted">
          {notSet.map((p) => (
            <span key={p.id} className="tr-row">
              <AvatarBubble avatar={p.avatar} name={p.name} size="sm" /> not set
            </span>
          ))}
          <span>· left out until they add a time</span>
        </div>
      )}
    </section>
  );
}
