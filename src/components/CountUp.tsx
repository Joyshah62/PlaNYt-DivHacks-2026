"use client";

import { useEffect, useState } from "react";

/**
 * Counts up to `value` once, on first appearance. Numbers are the headline of
 * every card, so the motion draws the eye to them; later changes (a new walk
 * radius, say) apply instantly, and reduced-motion readers never see it move.
 */
export function CountUp({ value, duration = 800 }: { value: number; duration?: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      frame = requestAnimationFrame(() => setProgress(1));
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setProgress(t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration]);

  const eased = 1 - (1 - progress) ** 3;
  return <span className="tabular-nums">{Math.round(value * eased).toLocaleString()}</span>;
}
