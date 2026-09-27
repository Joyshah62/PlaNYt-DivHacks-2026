import Link from "next/link";
import { BRAND } from "@/lib/plan/display";

const SECTIONS = [
  { label: "The front page", href: "#top" },
  { label: "How it works", href: "#watch" },
  { label: "Neighborhoods", href: "#neighborhoods" },
  { label: "The planner", href: "/plan" },
];

const SOURCES = [
  { what: "3D city", from: "Google Maps Platform" },
  { what: "Satellite", from: "Esri World Imagery" },
  { what: "Places & streets", from: "OpenStreetMap" },
  { what: "Crowds", from: "MTA subway ridership, data.ny.gov" },
  { what: "Weather", from: "Open-Meteo" },
  { what: "Photos", from: "Wikimedia Commons" },
];

/** The page's sign-off, set like a magazine colophon: a closing line, the index, the credits. */
export function Colophon() {
  return (
    <footer className="ed-colophon ed-paper ed-gut">
      <div className="ed-colophon-top">
        <p className="ed-colophon-lede ed-display">
          A day in New York, planned around the subway, the opening hours <i>and the quiet hours.</i>
        </p>
        <Link href="/plan" className="ed-btn">Plan your day →</Link>
      </div>

      <div className="ed-colophon-grid">
        <nav aria-label="Sections">
          <h2 className="ed-mono ed-kicker">Sections</h2>
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.href}>
                {s.href.startsWith("/") ? <Link href={s.href}>{s.label}</Link> : <a href={s.href}>{s.label}</a>}
              </li>
            ))}
          </ul>
        </nav>
        <section aria-label="Sources">
          <h2 className="ed-mono ed-kicker">Sources</h2>
          <dl>
            {SOURCES.map((s) => (
              <div key={s.what}>
                <dt className="ed-mono">{s.what}</dt>
                <dd>{s.from}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-label="Colophon">
          <h2 className="ed-mono ed-kicker">Colophon</h2>
          <p>
            Set in Instrument Serif, Newsreader and IBM Plex Mono. Crowd levels describe the area around a place, not
            the line inside it. Built for DivHacks 2026, <i>Move Smarter</i> track.
          </p>
        </section>
      </div>

      <div className="ed-colophon-base ed-mono">
        <span>© {new Date().getFullYear()} {BRAND.name} · New York, N.Y. · <Link href="/privacy">Privacy</Link></span>
        <a href="#top">Back to top ↑</a>
      </div>
    </footer>
  );
}
