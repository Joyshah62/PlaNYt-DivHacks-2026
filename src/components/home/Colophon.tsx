import Link from "next/link";
import { BRAND } from "@/lib/plan/display";

export function Colophon() {
  return (
    <footer className="ed-colophon ed-paper ed-gut">
      <span className="ed-colophon-mark ed-display">{BRAND.name}</span>
      <p>A day in New York, planned around the subway, the opening hours and the quiet hours.</p>
      <p className="ed-mono">
        Maps: Google Maps Platform, OpenStreetMap, Esri · Crowds: MTA subway ridership (data.ny.gov) · Weather: Open-Meteo · Photos: Wikimedia Commons
      </p>
      <nav className="ed-mono" aria-label="Footer">
        <Link href="/plan">Planner</Link>
        <a href="#top">Back to top</a>
      </nav>
    </footer>
  );
}
