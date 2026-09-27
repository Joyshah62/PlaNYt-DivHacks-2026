"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fitStops, interpolate, routePath, type Camera, type LatLng } from "./camera";
import { DEMOS, ORBIT_SECONDS, type DemoPlan } from "./data";
import type { CityMap } from "./cityMap";
import { useCityMap } from "./useCityMap";
import { useInView, usePageVisible, usePrefersReducedMotion } from "./visibility";

const REPLAY_AFTER_MS = 60_000;
const label = (plan: DemoPlan, i: number) => `${i + 1} · ${plan.stops[i].name}`;
/** The plan's route camera, pulled back so every stop stays on this map while it orbits. */
const routeView = (plan: DemoPlan, map: CityMap, host: HTMLElement | null): Camera =>
  fitStops(plan.stops, plan.route, host?.clientWidth ?? 0, host?.clientHeight ?? 0, map.engine === "maplibre");

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
  const { map } = useCityMap(hostRef, DEMOS[0].overview, "secondary", near);
  const [planIndex, setPlanIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const plan = DEMOS[planIndex];

  const play = useCallback(async (index: number) => {
    if (!map || !typedRef.current) return;
    runRef.current?.abort();
    const run = new AbortController();
    runRef.current = run;
    const typed = typedRef.current;
    const plan = DEMOS[index];
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        run.signal.addEventListener("abort", () => (clearTimeout(t), reject(run.signal.reason)), { once: true });
      });

    map.clearOverlays();
    setPlanIndex(index);
    setShown(0);
    setDone(false);
    typed.textContent = "";
    if (reduced) {
      typed.textContent = plan.sentence;
      plan.stops.forEach((s, i) => map.addPin(s, label(plan, i)));
      map.setRoute(routePath(plan.stops, 24));
      map.jumpTo(routeView(plan, map, hostRef.current));
      setShown(plan.stops.length);
      setDone(true);
      return;
    }
    try {
      void map.flyTo(plan.overview, 800);
      for (let i = 1; i <= plan.sentence.length; i++) {
        typed.textContent = plan.sentence.slice(0, i);
        await wait(26);
      }
      await wait(300);
      void map.flyTo(routeView(plan, map, hostRef.current), 1600);
      await wait(1200);
      const path: LatLng[] = [plan.stops[0]];
      for (let i = 0; i < plan.stops.length; i++) {
        map.addPin(plan.stops[i], label(plan, i));
        setShown(i + 1);
        const next = plan.stops[i + 1];
        if (next) {
          for (const p of interpolate(plan.stops[i], next, 24)) {
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

  const playNext = useCallback(() => void play((planIndex + 1) % DEMOS.length), [play, planIndex]);

  // Play the first plan the first time the section is in the middle of the screen with its map ready.
  useEffect(() => {
    if (map && visible && !started.current) {
      started.current = true;
      void play(0);
    }
  }, [map, visible, play]);

  useEffect(() => () => runRef.current?.abort(), []);

  // Keep it alive: after a minute of a finished plan sitting in view, plan the next one. Leaving
  // the section (or hiding the tab) resets the minute; nothing replays off screen.
  useEffect(() => {
    if (!done || reduced || !visible || !pageVisible) return;
    const timer = setTimeout(playNext, REPLAY_AFTER_MS);
    return () => clearTimeout(timer);
  }, [done, reduced, visible, pageVisible, playNext]);

  // Idle when off screen.
  useEffect(() => {
    if (!map || !done || reduced) return;
    if (visible && pageVisible) map.orbit(routeView(plan, map, hostRef.current), ORBIT_SECONDS);
    else map.stop();
  }, [map, done, visible, pageVisible, reduced, plan]);

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
          {plan.stops.map((s, i) => (
            <li key={s.name} className={`ed-row${i < shown ? " on" : ""}`}>
              <span className="ed-bullet">{i + 1}</span>
              <span className="ed-row-time">{s.time}</span>
              <div>
                <div className="ed-row-name">{s.name}</div>
                <div className="ed-row-why">{s.why}</div>
              </div>
              <div className="ed-crowd" role="img" aria-label={`Crowds by hour at ${s.name}; Roam picked a quiet one`}>
                {s.crowd.map((h, j) => <b key={j} className={j === s.slot ? "on" : undefined} style={{ height: `${h * 11}%` }} />)}
              </div>
            </li>
          ))}
        </ol>
        <div className="ed-demo-controls">
          <button type="button" className="ed-btn ed-btn--ghost" onClick={playNext} disabled={!map}>
            ↻ Another plan
          </button>
          <span className="ed-mono ed-demo-count">Plan {planIndex + 1} of {DEMOS.length}</span>
        </div>
        <p className="ed-footnote ed-mono">Example days. In the planner, the crowd bars come from MTA subway ridership near each stop.</p>
      </div>
      <div className="ed-demo-map">
        <div ref={hostRef} className="ed-map-host" />
        <div className={`ed-callout${done ? " on" : ""}`}>
          <span className="ed-mono ed-kicker">Roam&apos;s order</span>
          <strong>{plan.saving}</strong>
          <em>and every stop at its quiet hour</em>
        </div>
      </div>
    </section>
  );
}
