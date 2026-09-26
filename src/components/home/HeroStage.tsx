"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { formatTicker } from "./camera";
import { HERO, HERO_LINKS } from "./data";
import { HomePrompt } from "./HomePrompt";

const WORD = "New York";
const glyphs = (stagger: number) =>
  [...WORD].map((c, i) => (
    <i key={i} style={stagger ? { animationDelay: `${i * stagger}s` } : undefined}>{c === " " ? " " : c}</i>
  ));

export function HeroStage() {
  return (
    <section id="top" className="ed-hero" aria-labelledby="hero-title">
      <div className="ed-hero-map" />
      <div className="ed-knock" aria-hidden>
        <span className="ed-knock-word">{glyphs(0)}</span>
      </div>
      <div className="ed-scrim" aria-hidden />
      <header className="ed-header ed-chrome">
        <Link href="/" className="ed-wordmark ed-display">Roam</Link>
        <nav className="ed-mono" aria-label="Sections">
          <a href="#watch" className="ed-navlink">How it works</a>
          <a href="#neighborhoods" className="ed-navlink">Neighborhoods</a>
          <a href="#journeys" className="ed-navlink">Journeys</a>
          <ThemeToggle className="ed-theme" />
          <Link href="/plan" className="ed-btn">Open planner →</Link>
        </nav>
      </header>
      <div className="ed-eyebrow ed-gut ed-mono ed-chrome">
        <span className="ed-kicker">The day planner · Vol. I</span>
        <span>New York, N.Y. · Late city edition</span>
      </div>
      <span className="ed-ticker ed-mono ed-chrome" aria-hidden>
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
    </section>
  );
}
