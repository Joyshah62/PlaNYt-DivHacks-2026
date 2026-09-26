import Link from "next/link";
import { JOURNEYS } from "./data";

export function Journeys() {
  return (
    <section id="journeys" className="ed-journeys ed-paper ed-gut" aria-labelledby="journeys-title">
      <span className="ed-mono ed-kicker">Contents</span>
      <h2 id="journeys-title" className="ed-h2">Four days, <i>already planned.</i></h2>
      <ol className="ed-contents">
        {JOURNEYS.map((j, i) => (
          <li key={j.id}>
            <Link href={{ pathname: "/plan", query: { q: j.query } }} className="ed-entry">
              <span className="ed-entry-no ed-display">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <span className="ed-mono ed-kicker">{j.show} · {j.duration}</span>
                <h3>{j.title}</h3>
                <ol className="ed-entry-stops">
                  {j.stops.map((s, k) => (
                    <li key={s}><span className="ed-bullet">{k + 1}</span>{s}</li>
                  ))}
                </ol>
              </div>
              <span className="ed-entry-go ed-mono">Plan this day →</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
