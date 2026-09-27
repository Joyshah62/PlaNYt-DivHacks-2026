"use client";

import { useEffect, useRef, useState } from "react";
import { clock } from "../bridge/index";

const STEP = 30;

/** A two-handle range in 30-minute steps. Drag either handle, or focus one and use the arrow keys. */
export function TimeRangeSlider({
  min,
  max,
  value,
  onChange,
  onCommit,
  minSpan = 60,
}: {
  min: number;
  max: number;
  value: { from: number; to: number };
  onChange: (v: { from: number; to: number }) => void;
  onCommit: (v: { from: number; to: number }) => void;
  minSpan?: number;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"from" | "to" | null>(null);
  const keyTimer = useRef<number | null>(null);
  useEffect(() => () => void (keyTimer.current && window.clearTimeout(keyTimer.current)), []);
  // Arrow keys can fire fast; save once they stop so saves can't land out of order.
  const commitSoon = (v: { from: number; to: number }) => {
    if (keyTimer.current) window.clearTimeout(keyTimer.current);
    keyTimer.current = window.setTimeout(() => onCommit(v), 400);
  };
  const pct = (m: number) => ((m - min) / (max - min)) * 100;
  const snap = (m: number) => Math.min(max, Math.max(min, Math.round(m / STEP) * STEP));

  function move(handle: "from" | "to", minutes: number) {
    const m = snap(minutes);
    const next = handle === "from" ? { from: Math.min(m, value.to - minSpan), to: value.to } : { from: value.from, to: Math.max(m, value.from + minSpan) };
    if (next.from !== value.from || next.to !== value.to) onChange(next);
    return next;
  }

  const toMinutes = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return min + ((clientX - r.left) / r.width) * (max - min);
  };

  const handle = (which: "from" | "to") => (
    <button
      type="button"
      role="slider"
      aria-label={which === "from" ? "Free from" : "Free until"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value[which]}
      aria-valuetext={clock(value[which])}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(which);
      }}
      onPointerMove={(e) => dragging === which && move(which, toMinutes(e.clientX))}
      onPointerUp={() => {
        setDragging(null);
        onCommit(value);
      }}
      onKeyDown={(e) => {
        const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? STEP : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -STEP : 0;
        if (!delta) return;
        e.preventDefault();
        commitSoon(move(which, value[which] + delta));
      }}
      className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none place-items-center rounded-full border-2 border-brand bg-background shadow transition active:cursor-grabbing active:scale-110"
      style={{ left: `${pct(value[which])}%` }}
    />
  );

  const ticks = [];
  for (let m = Math.ceil(min / 180) * 180; m <= max; m += 180) ticks.push(m);

  return (
    <div className="px-2.5 pt-1">
      <div ref={track} className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand" style={{ left: `${pct(value.from)}%`, width: `${pct(value.to) - pct(value.from)}%` }} />
        {handle("from")}
        {handle("to")}
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-muted-foreground">
        {ticks.map((m) => (
          <span key={m} className="absolute -translate-x-1/2" style={{ left: `${pct(m)}%` }}>
            {clock(m)}
          </span>
        ))}
      </div>
    </div>
  );
}
