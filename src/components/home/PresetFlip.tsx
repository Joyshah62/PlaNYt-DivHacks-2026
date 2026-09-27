"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PRESETS } from "./data";
import { usePrefersReducedMotion } from "./visibility";

const SLOTS = 3;
const FLIP_EVERY_MS = 4500;
const FLIP_HALF_MS = 550; // the fall-away; matches .ed-flip.out's transition in home.css

/**
 * The hero's shortcuts, like a split-flap board: three show at a time and, one slot per beat,
 * flip over to the next preset. Pauses while a link is hovered or focused, off screen, and for
 * reduced motion.
 */
export function PresetFlip({ active }: { active: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [slots, setSlots] = useState(() => Array.from({ length: SLOTS }, (_, i) => ({ preset: i, flipping: false })));
  const [paused, setPaused] = useState(false);
  const nextPreset = useRef(SLOTS); // round-robin: the incoming preset is never one on show
  const nextSlot = useRef(0);

  useEffect(() => {
    if (!active || paused || reduced) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const beat = setInterval(() => {
      const slot = nextSlot.current;
      const incoming = nextPreset.current % PRESETS.length;
      nextSlot.current = (slot + 1) % SLOTS;
      nextPreset.current += 1;
      setSlots((s) => s.map((x, i) => (i === slot ? { ...x, flipping: true } : x)));
      settle = setTimeout(() => setSlots((s) => s.map((x, i) => (i === slot ? { preset: incoming, flipping: false } : x))), FLIP_HALF_MS);
    }, FLIP_EVERY_MS);
    return () => {
      clearInterval(beat);
      clearTimeout(settle);
    };
  }, [active, paused, reduced]);

  return (
    <ul
      className="ed-chips"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {slots.map(({ preset, flipping }, i) => {
        const p = PRESETS[preset];
        return (
          <li key={i} className="ed-flip-slot">
            {/* keyed by preset so a new label mounts and plays the flip-in */}
            <Link key={preset} href={{ pathname: "/plan", query: { q: p.query } }} className={`ed-flip${flipping ? " out" : ""}`}>
              {p.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
