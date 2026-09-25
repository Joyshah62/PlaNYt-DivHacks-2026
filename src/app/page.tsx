import Link from "next/link";
import { ArrowRight, Building2, Route, ShieldAlert, ShoppingBasket, Sparkles, TrainFront, Waves } from "lucide-react";
import { AddressSearch } from "@/components/AddressSearch";
import { AmbientMapLazy } from "@/components/map/LazyMaps";

const EXAMPLES = [
  { label: "765 Lincoln Ave, Brooklyn", note: "long record" },
  { label: "123 Bedford Ave, Brooklyn", note: "Williamsburg" },
  { label: "350 E 21st St, Manhattan", note: "Gramercy" },
];

const FEATURES = [
  {
    icon: Waves,
    title: "Real walking distance",
    body: "5, 10 and 15-minute zones traced along actual streets, not circles drawn on a map.",
  },
  {
    icon: ShoppingBasket,
    title: "Everything around you",
    body: "Groceries, food by cuisine, coffee, gyms and parks. Tap any pin for hours and the walking route.",
  },
  {
    icon: Route,
    title: "Your commute, drawn",
    body: "Add work or school and see the route, plus drive and walk times to the rest of the city.",
  },
  {
    icon: Building2,
    title: "The building's record",
    body: "Open HPD violations and reported problems in plain English, with a checklist for the viewing.",
  },
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
            <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-foreground font-display text-xl text-background">R</span>
            RentCheck <span className="-ml-1 font-display text-lg font-normal text-muted-foreground italic">NYC</span>
          </Link>
          <a href="#how" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-card/80 hover:text-foreground">
            How it works
          </a>
        </header>

        <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-5 pt-6 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="max-w-2xl">
            <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="size-1.5 rounded-full bg-brand" /> Free · Built on NYC open data and OpenStreetMap
            </p>
            <h1
              className="animate-rise mt-6 font-display text-[3.4rem] leading-[0.95] tracking-tight text-balance sm:text-7xl lg:text-[5.6rem]"
              style={{ "--delay": "60ms" } as React.CSSProperties}
            >
              Know the block <em className="text-brand">before</em> you sign.
            </h1>
            <p className="animate-rise mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground" style={{ "--delay": "120ms" } as React.CSSProperties}>
              Enter any NYC address. See the building&apos;s record, what&apos;s a short walk away, and how long your commute really is, all on one map.
            </p>
            <div className="animate-rise mt-9 max-w-xl" style={{ "--delay": "180ms" } as React.CSSProperties}>
              <AddressSearch />
            </div>
            <div className="animate-rise mt-5 flex flex-wrap items-center gap-2 text-sm" style={{ "--delay": "240ms" } as React.CSSProperties}>
              <span className="text-muted-foreground">Try</span>
              {EXAMPLES.map((e) => (
                <Link
                  key={e.label}
                  href={`/preferences?address=${encodeURIComponent(e.label)}`}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 backdrop-blur transition hover:border-foreground/25"
                >
                  <span className="font-medium">{e.label}</span>
                  <span className="text-muted-foreground max-sm:hidden">· {e.note}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* A preview of the report's language. Illustrative, and labelled so. */}
          <div className="relative hidden h-[440px] lg:block" aria-hidden>
            <div className="animate-rise absolute top-0 right-6 w-64 rounded-2xl bg-card/90 p-4 shadow-2xl ring-1 ring-foreground/8 backdrop-blur-xl" style={{ "--delay": "300ms", "--c": "var(--cat-subway)" } as React.CSSProperties}>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrainFront className="size-4 text-(--c)" /> Nearest subway
              </p>
              <p className="mt-2 font-display text-5xl leading-none">
                4<span className="ml-1 font-sans text-base text-muted-foreground">min walk</span>
              </p>
            </div>
            <div className="animate-rise absolute top-32 left-0 w-72 rounded-2xl bg-card/90 p-4 shadow-2xl ring-1 ring-foreground/8 backdrop-blur-xl" style={{ "--delay": "380ms" } as React.CSSProperties}>
              <p className="text-xs text-muted-foreground">Within a 10-minute walk</p>
              <p className="mt-1 font-display text-4xl leading-none">86 places</p>
              <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                {[
                  ["restaurants", 34],
                  ["coffee", 12],
                  ["groceries", 9],
                  ["parks", 7],
                  ["fitness", 5],
                  ["nightlife", 11],
                  ["pharmacy", 4],
                ].map(([c, n]) => (
                  <span key={c} style={{ flexGrow: n as number, background: `var(--cat-${c})` }} />
                ))}
              </div>
            </div>
            <div className="animate-rise absolute right-0 bottom-6 w-72 rounded-2xl bg-card/90 p-4 shadow-2xl ring-1 ring-foreground/8 backdrop-blur-xl" style={{ "--delay": "460ms" } as React.CSSProperties}>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldAlert className="size-4 text-sev-c" /> HPD violations listed open
              </p>
              <p className="mt-2 font-display text-4xl leading-none">
                2 <span className="font-sans text-sm text-muted-foreground">hazardous · ask about repairs</span>
              </p>
            </div>
            <p className="absolute bottom-0 left-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Sample report</p>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto w-full max-w-7xl scroll-mt-8 px-5 py-20 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="max-w-xl font-display text-4xl leading-tight tracking-tight text-balance sm:text-5xl">One address. Everything a listing leaves out.</h2>
          <ol className="flex flex-wrap gap-2 text-sm">
            {["Enter an address", "Pick what matters", "Explore the map"].map((step, i) => (
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
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-brand" aria-hidden /> A personal match score is on the way.
        </p>
      </section>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto max-w-7xl px-5 py-8 text-xs leading-relaxed text-muted-foreground sm:px-8">
          Built on open data: NYC HPD violations and complaints, PLUTO, NYC Planning GeoSearch, OpenStreetMap (Overpass), OSRM and Valhalla routing,
          OpenFreeMap tiles. Times are estimates, not live traffic or transit.
        </div>
      </footer>
    </div>
  );
}
