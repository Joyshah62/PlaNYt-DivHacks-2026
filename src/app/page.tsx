import Link from "next/link";
import { ArrowRight, Clock, Route, Sparkles, TrainFront, Users } from "lucide-react";
import { AmbientMapLazy } from "@/components/map/LazyMaps";
import { LandingPrompt } from "@/components/plan/LandingPrompt";
import { BRAND } from "@/lib/plan/display";

const FEATURES = [
  {
    icon: Users,
    title: "Around the crowds",
    body: "Hour-by-hour busyness from MTA subway ridership near every stop, so the Met gets your quiet morning, not the 3pm rush.",
  },
  {
    icon: Route,
    title: "The best order, worked out",
    body: "Every possible order of your stops is checked against travel time, opening hours and your end time. No zig-zagging across town.",
  },
  {
    icon: TrainFront,
    title: "However you get around",
    body: "Walk, bike, drive, or subway plus walking. Real street routes on OpenStreetMap, drawn on the map leg by leg.",
  },
  {
    icon: Sparkles,
    title: "Just describe it",
    body: "“A chill Sunday in Brooklyn, a museum and good pizza.” Gemini turns it into stops; the planner does the math.",
  },
];

/** An illustrative day, labelled as a sample. */
const SAMPLE = [
  { time: "9:00am", name: "Central Park", crowd: "Quiet", color: "var(--cat-parks)" },
  { time: "10:45am", name: "The Met", crowd: "Moderate", color: "var(--sev-b)" },
  { time: "1:40pm", name: "Top of the Rock", crowd: "Moderate", color: "var(--sev-b)" },
  { time: "3:45pm", name: "Chelsea Market", crowd: "Busy", color: "var(--cat-restaurants)" },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <section className="relative isolate flex min-h-[92dvh] flex-col overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-20">
          <AmbientMapLazy className="size-full" />
        </div>
        {/* Wash the map toward the page on the reading side so type stays crisp. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/90 to-background/5 max-lg:via-background/80 max-lg:to-background/60" />

        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-foreground font-display text-xl text-background">
              {BRAND.name[0]}
            </span>
            {BRAND.name} <span className="-ml-1 font-display text-lg font-normal text-muted-foreground italic">{BRAND.suffix}</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <a href="#how" className="rounded-full px-3 py-1.5 text-muted-foreground transition hover:bg-card/80 hover:text-foreground">
              How it works
            </a>
            <Link href="/plan" className="rounded-full bg-foreground px-4 py-1.5 font-medium text-background transition hover:bg-foreground/85">
              Open planner
            </Link>
          </nav>
        </header>

        <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-5 pt-6 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="max-w-2xl">
            <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="size-1.5 rounded-full bg-brand" /> Free · Built on MTA ridership and OpenStreetMap
            </p>
            <h1
              className="animate-rise mt-6 font-display text-[3.4rem] leading-[0.95] tracking-tight text-balance sm:text-7xl lg:text-[5.6rem]"
              style={{ "--delay": "60ms" } as React.CSSProperties}
            >
              See New York, <em className="text-brand">not</em> the crowds.
            </h1>
            <p className="animate-rise mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground" style={{ "--delay": "120ms" } as React.CSSProperties}>
              Tell us what you want to see. We put it in the right order and at the right times: less travel, fewer lines, nothing closed when you arrive.
            </p>
            <div className="animate-rise mt-9 max-w-xl" style={{ "--delay": "180ms" } as React.CSSProperties}>
              <LandingPrompt />
            </div>
            <p className="animate-rise mt-4 text-sm text-muted-foreground" style={{ "--delay": "240ms" } as React.CSSProperties}>
              Rather pick spots yourself?{" "}
              <Link href="/plan" className="font-medium text-foreground underline-offset-4 hover:underline">
                Browse 40+ places on the map
              </Link>
            </p>
            <p className="animate-rise mt-2 text-sm text-muted-foreground" style={{ "--delay": "260ms" } as React.CSSProperties}>
              Planning with friends?{" "}
              <Link href="/start" className="font-medium text-foreground underline-offset-4 hover:underline">
                Start a trip room →
              </Link>
            </p>
          </div>

          <div className="relative hidden lg:block" aria-hidden>
            <div
              className="animate-rise ml-auto w-80 rounded-3xl bg-card/90 p-5 shadow-2xl ring-1 ring-foreground/8 backdrop-blur-xl"
              style={{ "--delay": "300ms" } as React.CSSProperties}
            >
              <p className="text-xs text-muted-foreground">Saturday · subway + walk</p>
              <p className="mt-1 font-display text-4xl leading-none">9am – 6pm</p>
              <ol className="mt-5 space-y-3">
                {SAMPLE.map((s, i) => (
                  <li key={s.name} className="flex items-center gap-3">
                    <span className="grid size-6 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.time}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: s.color }}>
                      <span className="size-2 rounded-full" style={{ background: s.color }} />
                      {s.crowd}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-xs">
                <Clock className="size-3.5 text-brand" /> Saves 1h 17m of travel vs. the order you added them
              </p>
            </div>
            <p className="mt-3 mr-2 text-right text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Sample day</p>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto w-full max-w-7xl scroll-mt-8 px-5 py-20 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="max-w-xl font-display text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            A day planned like a local would plan it.
          </h2>
          <ol className="flex flex-wrap gap-2 text-sm">
            {["Pick or describe", "Choose how you'll travel", "Get your day"].map((step, i) => (
              <li key={step} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
                <span className="grid size-5 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">{i + 1}</span>
                {step}
                {i < 2 && <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />}
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-card p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 font-display text-2xl leading-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto max-w-7xl px-5 py-8 text-xs leading-relaxed text-muted-foreground sm:px-8">
          Built on open data: MTA Subway Hourly Ridership (data.ny.gov), OpenStreetMap, OSRM routing, Nominatim, NYC Planning GeoSearch and
          OpenFreeMap tiles. Crowd levels describe the area around a place, not the line inside it. Opening hours are typical; check before you go.
        </div>
      </footer>
    </div>
  );
}
