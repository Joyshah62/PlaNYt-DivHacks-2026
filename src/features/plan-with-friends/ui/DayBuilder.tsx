"use client";

import { ArrowDown, ArrowUp, GripVertical, Plus, RefreshCw, X } from "lucide-react";
import { useState, type DragEvent } from "react";
import { clock, CROWD_COLOR, CROWD_LABEL, duration, isMealBreak, LEG_VERB, type DayPlan } from "../bridge/index";
import { cn, CrowdStrip } from "../bridge/ui";
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
  const dragProps = (key: string, from: "day" | "tray") =>
    editable
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", key);
            setDrag({ key, from });
          },
          onDragEnd: () => {
            setDrag(null);
            setOver(null);
          },
        }
      : {};

  const windowEnd = plan?.request.endMin ?? null;
  const overMin = plan?.summary.overMin ?? 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-busy={updating}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{locked ? "Final day" : "The day"}</h2>
          <p className="text-xs text-muted-foreground">
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
          <button type="button" onClick={onRegenerate} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-brand hover:text-brand">
            <RefreshCw className="size-3.5" aria-hidden /> Regenerate plan
          </button>
        )}
      </div>

      {it.stale && !locked && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <span className="flex-1">Votes and times changed since this plan was made</span>
          {editable && (
            <button type="button" onClick={onRegenerate} className="rounded-full bg-foreground px-3 py-1 font-medium text-background">
              Regenerate
            </button>
          )}
        </div>
      )}
      {overMin > 0 && windowEnd !== null && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          ⚠ This runs about {duration(overMin)} past the group&apos;s time (until {clock(windowEnd)}). Drag a place out, or keep it and leave later.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {!order.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Vote for a place to build the day.</p>
      ) : (
        <ol className="mt-3 flex flex-col" onDragLeave={() => setOver(null)}>
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
                  setOver(i);
                }}
                onDrop={onDropAt(i)}
                className={cn("grid grid-cols-[3.75rem_1fr] gap-2 rounded-lg transition", drag?.key === s.key && "opacity-40", over === i && drag && "shadow-[inset_0_2px_0_0_var(--color-brand)]")}
              >
                <span className="pt-0.5 text-sm font-semibold tabular-nums">{clock(s.startMin)}</span>
                <div className="border-l-2 border-brand pb-3 pl-3">
                  {legText && <p className="text-xs text-muted-foreground">{legText}</p>}
                  <div className="flex items-center gap-2.5">
                    {editable && <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />}
                    <PlaceThumb stop={s} className="size-9 rounded-lg" />
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</p>
                    {editable && (
                      <span className="flex shrink-0 gap-0.5">
                        <button type="button" aria-label={`Move ${s.name} earlier`} disabled={i === 0} onClick={() => moveTo(s.key, i - 1)} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30">
                          <ArrowUp className="size-3.5" aria-hidden />
                        </button>
                        <button type="button" aria-label={`Move ${s.name} later`} disabled={i === stops.length - 1} onClick={() => moveTo(s.key, i + 1)} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30">
                          <ArrowDown className="size-3.5" aria-hidden />
                        </button>
                        <button type="button" aria-label={`Take ${s.name} out of the day`} disabled={stops.length === 1} onClick={() => removeFromDay(s.key)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30">
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {misses.length > 0 && <span className="mr-1.5 text-amber-600 dark:text-amber-400">{misses.join(" ")} can&apos;t make this ·</span>}
                    {duration(s.endMin - s.startMin)}
                    {s.crowd && (
                      <>
                        {" · "}
                        <span style={{ color: CROWD_COLOR[s.crowd.band] }} className="font-semibold">
                          {CROWD_LABEL[s.crowd.band]}
                        </span>
                      </>
                    )}
                    {c && c.votes.length > 0 && ` · ${c.votes.length} vote${c.votes.length === 1 ? "" : "s"}`}
                    {s.issue === "closed" && <span className="ml-1 text-destructive">· closed then</span>}
                  </p>
                  {s.crowd && <CrowdStrip levels={s.crowd.levels} visitStart={s.startMin} visitEnd={s.endMin} fromHour={fromHour} toHour={Math.min(24, fromHour + 8)} className="mt-1 max-w-64" />}
                </div>
              </li>
            );
          })}
          {editable && drag && (
            <li onDragOver={(e) => (e.preventDefault(), setOver(stops.length))} onDrop={onDropAt(stops.length)} className={cn("ml-[3.75rem] rounded-lg border border-dashed border-border py-2 text-center text-xs text-muted-foreground", over === stops.length && "border-brand text-brand")}>
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
          className={cn("mt-2 rounded-xl border border-dashed p-3 transition", over === "tray" ? "border-brand bg-brand-soft/40" : "border-border")}
        >
          <p className="mb-2 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">Also in the running</p>
          {it.tray.length === 0 && <p className="text-xs text-muted-foreground">Drop here to take it out of the day</p>}
          <ul className="flex flex-wrap gap-2">
            {it.tray.map((key) => {
              const c = byKey.get(key);
              if (!c) return null;
              return (
                <li key={key} {...dragProps(key, "tray")} className={cn("flex items-center gap-2 rounded-full border border-border bg-background py-1 pr-1 pl-1", editable && "cursor-grab", drag?.key === key && "opacity-40")}>
                  <PlaceThumb stop={c.stop} className="size-6 rounded-full" />
                  <span className="max-w-40 truncate text-xs font-medium">{c.stop.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {c.votes.length} vote{c.votes.length === 1 ? "" : "s"}
                  </span>
                  {editable && (
                    <button type="button" aria-label={`Add ${c.stop.name} to the day`} onClick={() => moveTo(key, order.length)} disabled={order.length >= 10} className="grid size-6 place-items-center rounded-full bg-foreground text-background disabled:opacity-40">
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {plan && plan.skipped.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Left out: {plan.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}</p>}
    </section>
  );
}
