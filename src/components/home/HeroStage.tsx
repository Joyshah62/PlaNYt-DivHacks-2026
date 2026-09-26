"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { formatTicker } from "./camera";
import { isLite, readEnv } from "./cityMap";
import { HERO, HERO_LINKS } from "./data";
import { DIVE_TIMING, diveFrame, measureDiveOrigin, type DiveOrigin } from "./diveOrigin";
import { HomePrompt } from "./HomePrompt";
import { useCityMap } from "./useCityMap";
import { useInView, usePageVisible, usePrefersReducedMotion } from "./visibility";

const WORD = "New York";
const glyphs = (stagger: number, offset = 0) =>
  [...WORD].map((c, i) => (
    <i key={i} style={{ animationDelay: `${offset + i * stagger}s` }}>{c === " " ? " " : c}</i>
  ));

/** Same rule as the inline script in page.tsx; also covers soft navigations, where that script doesn't run. */
function introSkipped(): boolean {
  const html = document.documentElement;
  if (html.dataset.intro === "skip") return true;
  const skip = matchMedia("(prefers-reduced-motion: reduce)").matches || isLite(readEnv());
  if (skip) html.dataset.intro = "skip";
  return skip;
}

function centreOf(word: HTMLElement): DiveOrigin {
  const r = word.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, radius: r.height * 0.06 };
}

export function HeroStage() {
  const heroRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const knockRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const tickerRef = useRef<HTMLSpanElement>(null);

  // Decided during the first client render, before paint. Not rendered, so no hydration mismatch.
  const [skip] = useState(() => typeof document !== "undefined" && introSkipped());
  const [settled, setSettled] = useState(skip);
  const { map, failed } = useCityMap(hostRef, HERO.high, "hero");
  const onScreen = useInView(heroRef);
  const pageVisible = usePageVisible();
  const reduced = usePrefersReducedMotion();

  // No map at all (no WebGL): show the finished page.
  useEffect(() => {
    if (failed) document.documentElement.dataset.intro = "skip";
  }, [failed]);

  // The intro. All per-frame work goes straight to the DOM; React re-renders once, at the end.
  useEffect(() => {
    if (!map) return;
    if (skip) {
      map.jumpTo(HERO.landed);
      return;
    }
    const hero = heroRef.current!, knock = knockRef.current!, word = wordRef.current!;
    let raf = 0, cancelled = false;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    // The city has painted: the letters rise with Manhattan already inside them, turning slowly.
    map.orbit(HERO.high, 240);
    document.fonts.ready.then(() => {
      if (cancelled) return;
      hero.classList.add("go");
      at(2300, () => {
        // Measured now, once the letters have finished rising (their transforms move the glyphs).
        const origin = measureDiveOrigin(word) ?? centreOf(word);
        const k = knock.getBoundingClientRect();
        knock.style.transformOrigin = `${origin.x - k.left}px ${origin.y - k.top}px`;
        const cover = Math.hypot(innerWidth, innerHeight) / Math.max(origin.radius, 1);
        hero.classList.add("dive");
        void map.flyTo(HERO.landed, 3600).then(() => !cancelled && setSettled(true));

        const t0 = performance.now();
        const frame = (now: number) => {
          const f = diveFrame(now - t0, cover);
          knock.style.transform = `scale(${f.scale})`;
          knock.style.opacity = String(f.opacity);
          if (!f.done) raf = requestAnimationFrame(frame);
          else hero.classList.remove("dive");
        };
        raf = requestAnimationFrame(frame);

        const { pre, dive } = DIVE_TIMING;
        at(pre + dive * 0.7, () => hero.classList.add("revealed"));
        at(pre + dive + 250, () => hero.classList.add("zoomed"));
        at(pre + dive + 1000, () => hero.classList.add("landed"));
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [map, skip]);

  // After landing: orbit the Empire State, but only while the hero is on screen and the tab is visible.
  useEffect(() => {
    if (!map || !settled || reduced) return;
    if (onScreen && pageVisible) map.orbit(HERO.landed, 200);
    else map.stop();
  }, [map, settled, onScreen, pageVisible, reduced]);

  // Coordinates ticker, at most 4 updates a second.
  useEffect(() => {
    if (!map) return;
    let last = 0;
    return map.onMove((lat, lng, heading) => {
      const now = performance.now();
      if (now - last < 250 || !tickerRef.current) return;
      last = now;
      tickerRef.current.textContent = formatTicker(lat, lng, heading);
    });
  }, [map]);

  function replay() {
    scrollTo(0, 0);
    location.reload();
  }

  return (
    <section ref={heroRef} id="top" className="ed-hero" aria-labelledby="hero-title">
      <div ref={hostRef} className="ed-hero-map" />
      <div ref={knockRef} className="ed-knock" aria-hidden>
        <span ref={wordRef} className="ed-knock-word">{glyphs(0.06, 0.1)}</span>
      </div>
      <div className="ed-scrim" aria-hidden />
      <header className="ed-header ed-chrome">
        <Link href="/" className="ed-wordmark ed-display">Roam</Link>
        <nav className="ed-mono" aria-label="Sections">
          <a href="#watch" className="ed-navlink">How it works</a>
          <a href="#neighborhoods" className="ed-navlink">Neighborhoods</a>
          <ThemeToggle className="ed-theme" />
          <Link href="/plan" className="ed-btn">Open planner →</Link>
        </nav>
      </header>
      <div className="ed-eyebrow ed-gut ed-mono ed-chrome">
        <span className="ed-kicker">The day planner · Vol. I</span>
        <span>New York, N.Y. · Late city edition</span>
      </div>
      <span ref={tickerRef} className="ed-ticker ed-mono ed-chrome" aria-hidden>
        {formatTicker(HERO.high.lat, HERO.high.lng, HERO.high.heading)}
      </span>
      <div className="ed-deck ed-gut">
        <h1 id="hero-title" className="ed-hero-title" aria-label="New York. See it all. Skip the crowds.">
          <span className="ed-solid ed-display">{glyphs(0.06)}</span>
          <span className="ed-tagline ed-display ed-late">See it all. <i>Skip the crowds.</i></span>
        </h1>
        <div className="ed-late ed-late--2">
          <HomePrompt />
          <ul className="ed-chips">
            {HERO_LINKS.map((l) => (
              <li key={l.label}><Link href={{ pathname: "/plan", query: { q: l.query } }}>{l.label}</Link></li>
            ))}
          </ul>
        </div>
      </div>
      <span className="ed-caption ed-mono" aria-hidden>Plate I · Midtown Manhattan, live</span>
      <button type="button" className="ed-replay ed-mono" onClick={replay}>↻ Replay intro</button>
    </section>
  );
}
