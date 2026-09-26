"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NEIGHBORHOODS } from "./data";
import { useCityMap } from "./useCityMap";
import { useInView, usePageVisible, usePrefersReducedMotion } from "./visibility";

export function NeighborhoodStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const chaptersRef = useRef<HTMLDivElement>(null);

  const near = useInView(sectionRef, { rootMargin: "100% 0px", once: true });
  const inView = useInView(sectionRef);
  const pageVisible = usePageVisible();
  const reduced = usePrefersReducedMotion();
  const { map } = useCityMap(hostRef, NEIGHBORHOODS[0].camera, "secondary", near);
  const [active, setActive] = useState(0);

  // The chapter crossing the middle of the screen is the active one.
  useEffect(() => {
    const chapters = chaptersRef.current?.querySelectorAll<HTMLElement>("[data-index]");
    if (!chapters) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
    }, { rootMargin: "-45% 0px -45% 0px" });
    chapters.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  // Fly to the active chapter, then orbit it; idle when off screen.
  useEffect(() => {
    if (!map) return;
    if (!inView || !pageVisible) return map.stop();
    const cam = NEIGHBORHOODS[active].camera;
    if (reduced) return map.jumpTo(cam);
    let live = true;
    void map.flyTo(cam, 3200).then(() => live && map.orbit(cam, 70));
    return () => {
      live = false;
    };
  }, [map, active, inView, pageVisible, reduced]);

  const current = NEIGHBORHOODS[active];
  return (
    <section ref={sectionRef} id="neighborhoods" className="ed-story ed-paper" aria-label="Neighborhoods">
      <div ref={chaptersRef}>
        {NEIGHBORHOODS.map((n, i) => (
          <article key={n.name} data-index={i} className={`ed-chapter ed-gut${i === active ? " active" : ""}`}>
            <span className="ed-mono ed-kicker">{i === 0 ? `Neighborhoods · ${n.numeral}` : n.numeral}</span>
            <h3>{n.name} <i>{n.italic}</i></h3>
            <p>{n.body}</p>
            <Link href={{ pathname: "/plan", query: { q: n.query } }} className="ed-mono">Plan a day here →</Link>
          </article>
        ))}
      </div>
      <div className="ed-sticky">
        <div ref={hostRef} className="ed-map-host" />
        <span className="ed-sticky-label ed-mono" aria-live="polite">{current.name} {current.italic}</span>
      </div>
    </section>
  );
}
