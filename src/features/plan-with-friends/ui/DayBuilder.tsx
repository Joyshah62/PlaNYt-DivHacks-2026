"use client";

import { ArrowDown, ArrowUp, GripVertical, Plus, RefreshCw, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { clock, CROWD_COLOR, CROWD_LABEL, duration, isMealBreak, LEG_VERB, type DayPlan } from "../bridge/index";
import { CrowdStrip } from "../bridge/ui";
import type { Trip } from "../core/types";
import { PlaceThumb } from "./PlaceThumb";

type Drag = { key: string; from: "day" | "tray" } | null;

/** "The day" and "Also in the running": arrange by dragging (or the arrow buttons); every change replans. */
export function DayBuilder({
  trip,
  plan,
  updating,
  error,
  canEdit,
  whoMisses,
  onSave,
  onRegenerate,
}: {
  trip: Trip;
  plan: DayPlan | null;
  updating: boolean;
  error: string | null;
  canEdit: boolean;
  whoMisses?: (start: number, end: number) => string[];
  onSave: (order: string[]) => void;
  onRegenerate: () => void;
}) {
  const [drag, setDrag] = useState<Drag>(null);
  const [over, setOver] = useState<number | "tray" | null>(null);
  const starting = useRef<number | undefined>(undefined);
  const it = trip.itinerary;
  const locked = !!trip.lockedCode;
  const stops = (plan?.stops ?? []).filter((s) => !isMealBreak(s));
  const order = stops.length ? stops.map((s) => s.key) : it.keys;
  const byKey = new Map(trip.candidates.map((c) => [c.stop.key, c]));
  const origin = trip.draft?.origin?.label ?? null;
  const editor = it.editedBy ? (trip.members[it.editedBy]?.name ?? "someone") : null;
  const editable = canEdit && !locked;

  const save = (next: string[]) => {
    if (next.length && next.join() !== order.join()) onSave(next);
  };
  const moveTo = (key: string, index: number) => {
    const rest = order.filter((k) => k !== key);
    rest.splice(Math.max(0, Math.min(index, rest.length)), 0, key);
    save(rest);
  };
  const removeFromDay = (key: string) => save(order.filter((k) => k !== key));

  const onDropAt = (index: number) => (e: DragEvent) => {
    e.preventDefault();
    if (drag) moveTo(drag.key, drag.from === "day" && order.indexOf(drag.key) < index ? index - 1 : index);
    setDrag(null);
    setOver(null);
  };
  /** Where a drop on stop i lands: before it in its top half, after it in its bottom half. */
  const slotAt = (i: number, e: DragEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY > r.top + r.height / 2 ? i + 1 : i;
  };
  const dragProps = (key: string, from: "day" | "tray") =>
    editable
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", key);
            // Chrome cancels a drag if the page changes during dragstart; show the drop zones just after.
            starting.current = window.setTimeout(() => setDrag({ key, from }));
          },
          onDragEnd: () => {
            // A drag that ends at once mustn't leave the drop zones showing.
            window.clearTimeout(starting.current);
            setDrag(null);
            setOver(null);
          },
        }
      : {};

  const windowEnd = plan?.request.endMin ?? null;
  const overMin = plan?.summary.overMin ?? 0;

  return (
    <section className="ed-panel" aria-busy={updating}>
      <div className="tr-day-header">
        <div>
          <h2 className="ed-h3">{locked ? "Final day" : "The day"}</h2>
          <p className="tr-day-subtitle">
            {locked
              ? "Locked. Open it in the planner to fine-tune, save or export."
              : updating
                ? "Updating times…"
                : it.manual && editor
                  ? `Edited by ${editor}${it.editedAt ? ` · ${clock(new Date(it.editedAt).getHours() * 60 + new Date(it.editedAt).getMinutes())}` : ""}`
                  : "Built from your votes, fitted to your time. Drag to change it."}
          </p>
        </div>
        {editable && it.manual && (
          <button type="button" onClick={onRegenerate} className="ed-btn ed-btn--ghost tr-day-regen">
            <RefreshCw aria-hidden /> Regenerate plan
          </button>
        )}
      </div>

      {it.stale && !locked && (
        <div className="tr-day-stale">
          <span className="tr-day-stale-text">Votes and times changed since this plan was made</span>
          {editable && (
            <button type="button" onClick={onRegenerate} className="ed-btn ed-small">
              Regenerate
            </button>
          )}
        </div>
      )}
      {overMin > 0 && windowEnd !== null && (
        <p className="tr-day-warning">
          ⚠ This runs about {duration(overMin)} past the group&apos;s time (until {clock(windowEnd)}). Drag a place out, or keep it and leave later.
        </p>
      )}
      {error && <p className="tr-day-error">{error}</p>}

      {!order.length ? (
        <p className="tr-day-empty">Vote for a place to build the day.</p>
      ) : (
        <ol className="tr-day-list" onDragLeave={() => setOver(null)}>
          {stops.map((s, i) => {
            const c = byKey.get(s.key);
            const misses = whoMisses?.(s.startMin, s.endMin) ?? [];
            const legText = s.leg && !(i === 0 && s.leg.minutes < 1) ? `${duration(s.leg.minutes)} ${LEG_VERB[s.leg.mode]}${i === 0 && origin ? ` from ${origin.replace(/^(Start at|Meet at) /, "")}` : ""}` : null;
            const fromHour = Math.max(6, Math.floor(s.startMin / 60) - 3);
            return (
              <li
                key={s.key}
                {...dragProps(s.key, "day")}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  setOver(slotAt(i, e));
                }}
                onDrop={(e) => onDropAt(slotAt(i, e))(e)}
                className={`tr-day-stop ${drag?.key === s.key ? "dragging" : ""} ${drag && over === i ? "drop-before" : ""} ${drag && over === i + 1 && i === stops.length - 1 ? "drop-after" : ""}`}
              >
                <span className="tr-day-time">{clock(s.startMin)}</span>
                <div className="tr-day-content">
                  {legText && <p className="tr-day-leg">{legText}</p>}
                  <div className="tr-day-place">
                    {editable && <GripVertical className="tr-day-grip" aria-hidden />}
                    <PlaceThumb stop={s} className="tr-day-thumb" />
                    <p className="tr-day-place-name">{s.name}</p>
                    {editable && (
                      <span className="tr-day-controls">
                        <button type="button" aria-label={`Move ${s.name} earlier`} disabled={i === 0} onClick={() => moveTo(s.key, i - 1)} className="tr-day-btn">
                          <ArrowUp className="size-3.5" aria-hidden />
                        </button>
                        <button type="button" aria-label={`Move ${s.name} later`} disabled={i === stops.length - 1} onClick={() => moveTo(s.key, i + 1)} className="tr-day-btn">
                          <ArrowDown className="size-3.5" aria-hidden />
                        </button>
                        <button type="button" aria-label={`Take ${s.name} out of the day`} disabled={stops.length === 1} onClick={() => removeFromDay(s.key)} className="tr-day-btn">
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    )}
                  </div>
                  <p className="tr-day-meta">
                    {misses.length > 0 && <span className="tr-day-meta-miss">{misses.join(" ")} can&apos;t make this ·</span>}
                    {duration(s.endMin - s.startMin)}
                    {s.crowd && (
                      <>
                        {" · "}
                        <span style={{ color: CROWD_COLOR[s.crowd.band], fontWeight: 600 }}>
                          {CROWD_LABEL[s.crowd.band]}
                        </span>
                      </>
                    )}
                    {c && c.votes.length > 0 && ` · ${c.votes.length} vote${c.votes.length === 1 ? "" : "s"}`}
                    {s.issue === "closed" && <span className="tr-day-meta-miss">· closed then</span>}
                  </p>
                  {s.crowd && <CrowdStrip levels={s.crowd.levels} visitStart={s.startMin} visitEnd={s.endMin} fromHour={fromHour} toHour={Math.min(24, fromHour + 8)} className="tr-day-crowd" />}
                </div>
              </li>
            );
          })}
          {editable && drag && (
            <li onDragOver={(e) => (e.preventDefault(), setOver(stops.length))} onDrop={onDropAt(stops.length)} className={`tr-day-drop-area ${over === stops.length ? "active" : ""}`}>
              Drop here to add at the end
            </li>
          )}
        </ol>
      )}

      {(it.tray.length > 0 || (drag?.from === "day" && editable)) && (
        <div
          onDragOver={(e) => {
            if (drag?.from !== "day") return;
            e.preventDefault();
            setOver("tray");
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (drag?.from === "day") removeFromDay(drag.key);
            setDrag(null);
            setOver(null);
          }}
          className={`tr-day-tray ${over === "tray" ? "over" : ""}`}
        >
          <p className="tr-day-tray-label">Also in the running</p>
          {it.tray.length === 0 && <p className="tr-day-tray-empty">Drop here to take it out of the day</p>}
          <ul className="tr-day-tray-items">
            {it.tray.map((key) => {
              const c = byKey.get(key);
              if (!c) return null;
              return (
                <li key={key} {...dragProps(key, "tray")} className={`tr-day-tray-item ${editable ? "editable" : ""} ${drag?.key === key ? "grabbing" : ""}`}>
                  <PlaceThumb stop={c.stop} className="tr-day-tray-thumb" />
                  <span className="tr-day-tray-name">{c.stop.name}</span>
                  <span className="tr-day-tray-votes">
                    {c.votes.length} vote{c.votes.length === 1 ? "" : "s"}
                  </span>
                  {editable && (
                    <button type="button" aria-label={`Add ${c.stop.name} to the day`} onClick={() => moveTo(key, order.length)} disabled={order.length >= 10} className="tr-day-tray-add">
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {plan && plan.skipped.length > 0 && <p className="tr-day-skipped">Left out: {plan.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}</p>}
    </section>
  );
}
