"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { interpolate, routePath, type LatLng } from "./camera";
import { DEMO, ORBIT_SECONDS } from "./data";
import { useCityMap } from "./useCityMap";
import { useInView, usePageVisible, usePrefersReducedMotion } from "./visibility";

const label = (i: number) => `${i + 1} · ${DEMO.stops[i].name}`;

export function PlanDemo() {
  const sectionRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const typedRef = useRef<HTMLSpanElement>(null);
  const runRef = useRef<AbortController | null>(null);
  const started = useRef(false);

  // This section starts right at the fold, so a look-ahead margin would load its map on page
  // load. Load it once the visitor has actually scrolled it into view.
  const near = useInView(sectionRef, { rootMargin: "0px 0px -15% 0px", once: true });
  // A band in the middle of the screen, so a section taller than the viewport still triggers.
  const visible = useInView(sectionRef, { rootMargin: "-30% 0px -30% 0px" });
  const pageVisible = usePageVisible();
  const reduced = usePrefersReducedMotion();
  const { map } = useCityMap(hostRef, DEMO.overview, "secondary", near);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);

  const play = useCallback(async () => {
    if (!map || !typedRef.current) return;
    runRef.current?.abort();
    const run = new AbortController();
    runRef.current = run;
    const typed = typedRef.current;
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        run.signal.addEventListener("abort", () => (clearTimeout(t), reject(run.signal.reason)), { once: true });
      });

    map.clearOverlays();
    setShown(0);
    setDone(false);
    typed.textContent = "";
    if (reduced) {
      typed.textContent = DEMO.sentence;
      DEMO.stops.forEach((s, i) => map.addPin(s, label(i)));
      map.setRoute(routePath(DEMO.stops, 24));
      map.jumpTo(DEMO.route);
      setShown(DEMO.stops.length);
      setDone(true);
      return;
    }
    try {
      void map.flyTo(DEMO.overview, 800);
      for (let i = 1; i <= DEMO.sentence.length; i++) {
        typed.textContent = DEMO.sentence.slice(0, i);
        await wait(26);
      }
      await wait(300);
      void map.flyTo(DEMO.route, 1600);
      await wait(1200);
      const path: LatLng[] = [DEMO.stops[0]];
      for (let i = 0; i < DEMO.stops.length; i++) {
        map.addPin(DEMO.stops[i], label(i));
        setShown(i + 1);
        const next = DEMO.stops[i + 1];
        if (next) {
          for (const p of interpolate(DEMO.stops[i], next, 24)) {
            path.push(p);
            map.setRoute(path);
            await wait(28);
          }
        }
        await wait(250);
      }
      setDone(true);
    } catch {
      // replaced by a newer run, or unmounted
    }
  }, [map, reduced]);

  // Play once, the first time the section is in the middle of the screen with its map ready.
  useEffect(() => {
    if (map && visible && !started.current) {
      started.current = true;
      void play();
    }
  }, [map, visible, play]);

  useEffect(() => () => runRef.current?.abort(), []);

  // Idle when off screen.
  useEffect(() => {
    if (!map || !done || reduced) return;
    if (visible && pageVisible) map.orbit(DEMO.route, ORBIT_SECONDS);
    else map.stop();
  }, [map, done, visible, pageVisible, reduced]);

  return (
    <section ref={sectionRef} id="watch" className="ed-demo ed-paper" aria-labelledby="watch-title">
      <div className="ed-demo-copy ed-gut">
        <span className="ed-mono ed-kicker">Watch it plan</span>
        <h2 id="watch-title" className="ed-h2">One sentence in.<br /><i>A whole day out.</i></h2>
        <div className="ed-prompt" aria-hidden>
          <span ref={typedRef} className="ed-typed" />
          <span className="ed-btn">Plan →</span>
        </div>
        <ol className="ed-itin" aria-label="Example itinerary">
          {DEMO.stops.map((s, i) => (
            <li key={s.name} className={`ed-row${i < shown ? " on" : ""}`}>
              <span className="ed-bullet">{i + 1}</span>
              <span className="ed-row-time">{s.time}</span>
              <div>
                <div className="ed-row-name">{s.name}</div>
                <div className="ed-row-why">{s.why}</div>
              </div>
              <div className="ed-crowd" role="img" aria-label={`Crowds by hour at ${s.name}; Roam picked a quiet one`}>
                {s.crowd.map((h, j) => <b key={j} className={j === s.slot ? "on" : undefined} style={{ height: h * 2 }} />)}
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="ed-btn ed-btn--ghost ed-demo-replay" onClick={() => void play()} disabled={!map}>
          ↻ Replay
        </button>
        <p className="ed-footnote ed-mono">An example day. In the planner, the crowd bars come from MTA subway ridership near each stop.</p>
      </div>
      <div className="ed-demo-map">
        <div ref={hostRef} className="ed-map-host" />
        <div className={`ed-callout${done ? " on" : ""}`}>
          <span className="ed-mono ed-kicker">Roam&apos;s order</span>
          <strong>44 min less travel</strong>
          <em>and every stop at its quiet hour</em>
        </div>
      </div>
    </section>
  );
}
