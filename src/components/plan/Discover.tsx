"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Binoculars,
  Coffee,
  Eye,
  Footprints,
  Hotel,
  IceCreamCone,
  Landmark,
  Loader2,
  Locate,
  MapPin,
  Palette,
  Plus,
  Replace,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Trees,
  UtensilsCrossed,
  Wine,
  X,
} from "lucide-react";
import type { Category } from "@/lib/discover/categories";
import type { Area, DiscoverResponse, Result } from "@/lib/discover/types";
import { CROWD_COLOR, CROWD_LABEL } from "@/lib/plan/display";
import { isMealBreak } from "@/lib/plan/profile";
import { clock, duration, toHHMM, toMinutes } from "@/lib/plan/time";
import type { DayPlan } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

const ICON: Record<Category, typeof Coffee> = {
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  bar: Wine,
  dessert: IceCreamCone,
  museum: Landmark,
  gallery: Palette,
  park: Trees,
  viewpoint: Binoculars,
  shopping: ShoppingBag,
  activity: Sparkles,
  landmark: Landmark,
};

const REFINE = ["Closer", "Cheaper", "Higher rated", "Something indoors", "Open later"];

// --- state -------------------------------------------------------------------------------

export interface Discover {
  query: string;
  setQuery: (q: string) => void;
  area: Area;
  setArea: (a: Area) => void;
  placement: { after: string | null; preferredStartMin: number | null };
  setPlacement: (value: { after: string | null; preferredStartMin: number | null }) => void;
  response: DiscoverResponse | null;
  loading: boolean;
  stale: boolean;
  error: string | null;
  selected: string | null;
  select: (key: string | null) => void;
  /** New search, or a follow-up that refines the current one. */
  search: (text: string, refine?: boolean) => Promise<void>;
  clear: () => void;
  present: (response: DiscoverResponse) => void;
  /** Results and the chosen one, for the map. */
  preview: { points: { key: string; lat: number; lon: number; label: string }[]; selected: string | null; detour: [number, number][] | null } | null;
}

export function useDiscover(plan: DayPlan | null): Discover {
  const [query, setQuery] = useState("");
  const [area, setAreaState] = useState<Area>({ kind: "trip" });
  const [pinned, setPinned] = useState(false);
  const [storedResponse, setResponse] = useState<DiscoverResponse | null>(null);
  const [responsePlan, setResponsePlan] = useState<DayPlan | null>(null);
  const response = responsePlan === plan ? storedResponse : null;
  const [loadingPlan, setLoadingPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [placement, setPlacementState] = useState<{ after: string | null; preferredStartMin: number | null }>({ after: null, preferredStartMin: null });
  const controller = useRef<AbortController | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const seq = useRef(0);

  const run = useCallback(
    async (text: string, opts: { refine: boolean; area: Area; pinned: boolean; reusePrevious?: boolean; placement?: typeof placement }) => {
      text = text.trim();
      if (!plan || text.length < 2) return;
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      const id = ++seq.current;
      setLoading(true);
      setLoadingPlan(plan);
      setError(null);
      try {
        const res = await fetch("/api/discover", {
          method: "POST",
          signal: abort.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: text,
            request: plan.request,
            area: opts.area,
            areaPinned: opts.pinned,
            previous: (opts.refine || opts.reusePrevious) && response ? response.intent : null,
            reusePrevious: opts.reusePrevious ?? false,
            placement: opts.placement ?? placement,
            placementPinned: opts.placement !== undefined || placement.after !== null,
          }),
        });
        const body = await res.json();
        if (id !== seq.current) return;
        if (!res.ok) throw new Error(body.error ?? "Couldn't search right now.");
        const r = body as DiscoverResponse;
        setResponse(r);
        setResponsePlan(plan);
        setPlacementState({ ...(opts.placement ?? placement), after: r.intent.after });
        setSelected(r.results[0]?.stop.key ?? null);
        // The words can move the search ("after the Met"): show where it looked.
        if (!opts.pinned) setAreaState({ kind: r.area.kind, stopKey: r.area.stopKey, neighborhood: r.area.neighborhood, lat: r.area.lat, lon: r.area.lon });
        if (!opts.refine && !opts.reusePrevious) setLastQuery(text);
      } catch (e) {
        if (!abort.signal.aborted && id === seq.current) setError(e instanceof Error ? e.message : "Couldn't search right now.");
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    [plan, response, placement],
  );

  const search = useCallback((text: string, refine = false) => run(text, { refine: refine && response !== null, reusePrevious: !refine && Boolean(response) && text.trim() === lastQuery, area, pinned }), [run, response, area, pinned, lastQuery]);

  const setArea = useCallback(
    (a: Area) => {
      setAreaState(a);
      setPinned(true);
      // Same search, new place to look.
      const text = query.trim() || lastQuery;
      if (text.length >= 2) void run(text, { refine: false, reusePrevious: Boolean(response) && text === lastQuery, area: a, pinned: true });
    },
    [response, run, query, lastQuery],
  );

  const setPlacement = (value: typeof placement) => {
    setPlacementState(value);
    const text = query.trim() || lastQuery;
    if (text.length >= 2) void run(text, { refine: false, reusePrevious: Boolean(response) && text === lastQuery, area, pinned, placement: value });
  };

  useEffect(() => () => { controller.current?.abort(); seq.current++; }, [plan]);

  const clear = useCallback(() => {
    seq.current++;
    controller.current?.abort();
    setQuery("");
    setPlacementState({ after: null, preferredStartMin: null });
    setResponse(null);
    setSelected(null);
    setError(null);
    setLoading(false);
    setPinned(false);
    setAreaState({ kind: "trip" });
    setLastQuery("");
  }, []);

  const present = (value: DiscoverResponse) => {
    controller.current?.abort();
    seq.current++;
    setLoading(false);
    setError(null);
    setResponse(value);
    setResponsePlan(plan);
    setQuery(value.intent.summary);
    setLastQuery(value.intent.summary);
    setSelected(value.results[0]?.stop.key ?? null);
  };

  const stale = Boolean(response) && query.trim() !== lastQuery;
  const chosen = response?.results.find((r) => r.stop.key === selected) ?? null;
  const preview = response && !stale && !error
    ? {
        points: response.results.map((r, i) => ({ key: r.stop.key, lat: r.lat, lon: r.lon, label: String.fromCharCode(65 + i) })),
        selected,
        detour: chosen?.detour.length ? chosen.detour : null,
      }
    : null;

  return { query, setQuery, area, setArea, placement, setPlacement, response, loading: loading && loadingPlan === plan, stale, error, selected, select: setSelected, search, clear, present, preview };
}

// --- the search bar -------------------------------------------------------------------

/** "Along my trip", "Near the Met", ...: where the search looks. */
function AreaChips({ d, plan }: { d: Discover; plan: DayPlan }) {
  const [hood, setHood] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const stops = plan.stops.filter((s) => !isMealBreak(s));
  const chip = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
      active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
    );

  function nearMe() {
    setLocationError(null);
    if (!navigator.geolocation) { setLocationError("Location is unavailable. Choose a stop or neighborhood instead."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        d.setArea({ kind: "here", lat: p.coords.latitude, lon: p.coords.longitude });
      },
      () => { setLocating(false); setLocationError("Couldn’t get your location. Choose a stop or neighborhood instead."); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 120_000 },
    );
  }

  return (
    <div className="-mx-5 mt-2.5 flex gap-1.5 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Where to look">
      <button type="button" className={chip(d.area.kind === "trip")} aria-pressed={d.area.kind === "trip"} onClick={() => d.setArea({ kind: "trip" })}>
        <Footprints className="size-3.5" aria-hidden /> Along my trip
      </button>
      <label className={cn(chip(d.area.kind === "stop"), "relative pr-2")}>
        <MapPin className="size-3.5" aria-hidden />
        <select
          value={d.area.kind === "stop" ? d.area.stopKey : ""}
          onChange={(e) => e.target.value && d.setArea({ kind: "stop", stopKey: e.target.value })}
          className="max-w-[9.5rem] appearance-none truncate bg-transparent pr-1 outline-none"
          aria-label="Near a stop"
        >
          <option value="">Near a stop…</option>
          {stops.map((s) => (
            <option key={s.key} value={s.key}>
              Near {s.name}
            </option>
          ))}
        </select>
      </label>
      {plan.request.origin && (
        <button type="button" className={chip(d.area.kind === "origin")} aria-pressed={d.area.kind === "origin"} onClick={() => d.setArea({ kind: "origin" })}>
          <Hotel className="size-3.5" aria-hidden /> Near {plan.request.origin.label.length > 18 ? "my start" : plan.request.origin.label}
        </button>
      )}
      <button type="button" className={chip(d.area.kind === "here")} aria-pressed={d.area.kind === "here"} onClick={nearMe}>
        {locating ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Locate className="size-3.5" aria-hidden />} Near me
      </button>
      {locationError && <span role="alert" className="min-w-48 text-xs text-sev-c">{locationError}</span>}
      {hood === null ? (
        <button type="button" className={chip(d.area.kind === "neighborhood")} aria-pressed={d.area.kind === "neighborhood"} onClick={() => setHood(d.area.neighborhood ?? "")}>
          <Search className="size-3.5" aria-hidden /> {d.area.kind === "neighborhood" ? `In ${d.area.neighborhood}` : "A neighborhood…"}
        </button>
      ) : (
        <form
          className="flex shrink-0 items-center gap-1 rounded-full border border-foreground bg-card py-0.5 pr-0.5 pl-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (hood.trim().length < 2) return;
            d.setArea({ kind: "neighborhood", neighborhood: hood.trim() });
            setHood(null);
          }}
        >
          <input autoFocus onKeyDown={(e) => { if (e.key === "Escape") setHood(null); }} value={hood} onChange={(e) => setHood(e.target.value)} placeholder="e.g. Williamsburg" aria-label="Neighborhood" className="w-32 bg-transparent text-xs outline-none" />
          <button type="submit" className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background">
            Go
          </button>
        </form>
      )}
    </div>
  );
}

/** The persistent bar: ask for something to add; with results, a follow-up refines them. */
export function DiscoverBar({ d, plan }: { d: Discover; plan: DayPlan }) {
  const [followUp, setFollowUp] = useState("");
  const refining = d.response !== null;
  return (
    <div className="mt-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void d.search(d.query);
        }}
        className="flex items-center gap-2 rounded-2xl border border-border bg-card py-1.5 pr-1.5 pl-3 shadow-sm transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10"
        suppressHydrationWarning
      >
        {d.loading ? <Loader2 className="size-4 shrink-0 animate-spin text-brand" aria-hidden /> : <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />}
        <input
          value={d.query}
          onChange={(e) => d.setQuery(e.target.value)}
          placeholder="Pizza, a quiet café, a museum…"
          aria-label="What would you like to add to your day?"
          maxLength={300}
          className="min-w-0 flex-1 bg-transparent py-1 text-[15px] outline-none placeholder:text-muted-foreground"
          suppressHydrationWarning
        />
        {refining && (
          <button type="button" onClick={d.clear} aria-label="Clear the search" className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" aria-hidden />
          </button>
        )}
        <button
          type="submit"
          disabled={d.loading || d.query.trim().length < 2}
          aria-label="Search"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-on-color transition disabled:opacity-40"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </form>
      <AreaChips d={d} plan={plan} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Place in my day</span>
          <select value={d.placement.after ?? ""} onChange={(e) => d.setPlacement({ ...d.placement, after: e.target.value || null })} className="w-full rounded-xl border border-border bg-card px-2 py-2 text-foreground">
            <option value="">Let Roam choose</option>
            {plan.stops.filter((s) => !isMealBreak(s)).map((s) => <option key={s.key} value={s.key}>After {s.name} · ends {clock(s.endMin)}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Preferred start (optional)</span>
          <input type="time" value={d.placement.preferredStartMin === null ? "" : toHHMM(d.placement.preferredStartMin)} onChange={(e) => d.setPlacement({ ...d.placement, preferredStartMin: toMinutes(e.target.value) })} className="w-full rounded-xl border border-border bg-card px-2 py-2 text-foreground" />
        </label>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">Search area controls where to look. Placement controls where it goes. Leave the time blank for a suggested time. A chosen time is saved with the stop; later arrivals are flagged.</p>
      {refining && <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (followUp.trim().length >= 2) { void d.search(followUp, true); setFollowUp(""); } }}>
        <input aria-label="Refine this search" placeholder="Refine these results: cheaper, quieter…" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs" maxLength={300} />
        <button type="submit" disabled={d.loading || d.stale || followUp.trim().length < 2} className="rounded-xl bg-muted px-3 text-xs font-medium disabled:opacity-40">Refine</button>
      </form>}
    </div>
  );
}

// --- results ------------------------------------------------------------------------------

function Photo({ r }: { r: Result }) {
  const frame = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<{ url: string; credit: string; creditUrl: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ name: r.name, lat: String(r.lat), lon: String(r.lon) });
    const load = () => {
      fetch(`/api/photo?${params}`)
        .then((res) => res.ok ? res.json() : null)
        .then((p) => { if (!cancelled) setPhoto(p); })
        .catch(() => {});
    };
    // Lazy-loading the image alone still spends API quota on every hidden card.
    // Wait until the card enters the viewport before requesting its photo.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        load();
      }
    });
    if (frame.current) observer.observe(frame.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [r.name, r.lat, r.lon]);
  const Icon = ICON[r.category];
  return (
    <div ref={frame} className="relative h-32 overflow-hidden bg-[radial-gradient(120%_120%_at_0%_0%,oklch(0.93_0.05_60)_0%,oklch(0.9_0.05_20)_55%,oklch(0.86_0.06_330)_100%)] dark:bg-[radial-gradient(120%_120%_at_0%_0%,oklch(0.35_0.06_60)_0%,oklch(0.3_0.06_20)_55%,oklch(0.28_0.06_330)_100%)]">
      {photo ? <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setPhoto(null)} className="size-full object-cover" />
        <span className="absolute right-1 bottom-1 max-w-[70%] truncate rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
          {photo.creditUrl ? <a href={photo.creditUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{photo.credit}</a> : photo.credit}
        </span>
      </> : (
        <Icon className="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-foreground/25" aria-hidden />
      )}
    </div>
  );
}

function travelLine(r: Result): string {
  if (r.travelDelta >= 2) return `Adds about ${duration(r.travelDelta)} of travel.`;
  if (r.travelDelta <= -2) return `Saves about ${duration(-r.travelDelta)} of travel.`;
  return "No extra travel.";
}

export function ResultCard({ r, index, best, active, busy, onSelect, onAdd }: { r: Result; index: number; best: boolean; active: boolean; busy: boolean; onSelect: () => void; onAdd: () => void }) {
  const fits = r.startMin !== null && !r.closed;
  const actionLabel = r.action === "replace" ? `Replace ${r.replaceName}` : r.action === "meal" ? `Make it my ${r.stop.mealFor}` : "Add to my day";
  return (
    <li data-result={r.stop.key} className="w-[82%] shrink-0 snap-start sm:w-72">
      <article
        onClick={onSelect}
        className={cn(
          "flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition",
          active ? "border-brand ring-4 ring-brand/15" : "border-border hover:border-foreground/25",
        )}
      >
        <div className="relative">
          <Photo r={r} />
          <span className="absolute top-2.5 left-2.5 grid size-7 place-items-center rounded-full bg-[#f97316] text-xs font-bold text-white shadow ring-2 ring-white">
            {String.fromCharCode(65 + index)}
          </span>
          {best && (
            <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-sev-b shadow backdrop-blur">
              <Star className="size-3 fill-current" aria-hidden /> Best fit
            </span>
          )}
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-background/90 px-2.5 py-0.5 text-[11px] font-semibold shadow backdrop-blur">{r.kind}</span>
        </div>
        <div className="flex flex-1 flex-col p-3.5">
          <h3 className="text-[15px] leading-snug font-semibold">{r.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {r.rating !== null && r.reviews ? (
              <span className="font-medium text-foreground">
                {r.rating.toFixed(1)}★ <span className="font-normal text-muted-foreground">({r.reviews.toLocaleString("en-US")})</span>
              </span>
            ) : (
              <span>No ratings</span>
            )}
            {r.price && <span>{"$".repeat(r.price)}</span>}
            <span>{r.openUntil !== null ? `Open until ${clock(r.openUntil)}` : "Hours not listed"}</span>
          </p>

          {/* The part that's ours: what it does to the day, from the planner. */}
          <div className="mt-2.5 rounded-2xl bg-muted/60 p-2.5 text-xs leading-relaxed">
            {r.closed ? (
              <p className="flex items-start gap-1.5 font-semibold text-sev-c">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden /> Closed that day
              </p>
            ) : fits ? (
              <>
                <p className="text-[13px] font-semibold">
                  {r.action === "replace" ? `Replaces ${r.replaceName}` : r.after ? `${r.conflicts.length ? "After" : "Fits after"} ${r.after}` : "First stop"}
                  <span className="font-normal text-muted-foreground"> · {clock(r.startMin!)}{r.endMin !== null && ` – ${clock(r.endMin)}`}</span>
                </p>
                <p className="text-muted-foreground">
                  {travelLine(r)}
                  {r.conflicts.length === 0 && r.keeps.length > 0 && ` ${r.keeps[0]} still fits.`}
                </p>
                {r.conflicts.map((c) => (
                  <p key={c} className="mt-0.5 flex items-start gap-1.5 font-medium text-sev-c">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden /> {c}
                  </p>
                ))}
              </>
            ) : (
              <p className="text-muted-foreground">Couldn&apos;t fit it into the day.</p>
            )}
          </div>

          {(r.reasons.length > 0 || r.crowdBand) && (
            <p className="mt-2 flex flex-wrap gap-1">
              {r.reasons.map((why) => (
                <span key={why} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                  {why}
                </span>
              ))}
              {r.crowdBand && fits && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                  <span className="size-1.5 rounded-full" style={{ background: CROWD_COLOR[r.crowdBand] }} aria-hidden />
                  {CROWD_LABEL[r.crowdBand]} then
                </span>
              )}
            </p>
          )}

          <div className="mt-auto flex gap-2 pt-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              aria-pressed={active}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold transition hover:bg-muted"
            >
              <Eye className="size-3.5" aria-hidden /> Preview
            </button>
            <button
              type="button"
              disabled={busy || r.closed || !fits || r.nextStops.length > 10}
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-semibold text-background transition hover:bg-foreground/85 disabled:opacity-40"
            >
              {r.action === "replace" ? <Replace className="size-3.5 shrink-0" aria-hidden /> : <Plus className="size-3.5 shrink-0" aria-hidden />}
              <span className="truncate">{actionLabel}</span>
            </button>
          </div>
        </div>
      </article>
    </li>
  );
}

export function DiscoverResults({ d, busy, onAdd }: { d: Discover; busy: boolean; onAdd: (r: Result) => void }) {
  const list = useRef<HTMLUListElement>(null);
  // Bring the chosen card into view when it's picked on the map.
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-result="${CSS.escape(d.selected ?? "")}"]`);
    if (el && list.current) list.current.scrollTo({ left: el.offsetLeft - 20, behavior: "smooth" });
  }, [d.selected]);

  if (!d.response && !d.loading && !d.error) return null;
  const r = d.response;
  return (
    <section aria-label="Places to add" className="mb-6 animate-rise">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{r ? r.intent.summary : "Searching…"}</h2>
          {r && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {r.area.label} ·{" "}
              {r.source === "google" ? "Ratings, prices and hours from Google" : "Places from OpenStreetMap, no ratings available"}
            </p>
          )}
        </div>
        <button type="button" onClick={d.clear} className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          Close
        </button>
      </div>

      {r && (
        <div className="-mx-5 mt-2.5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="group" aria-label="Refine">
          {REFINE.map((label) => (
            <button
              key={label}
              type="button"
              disabled={d.loading || d.stale}
              onClick={() => void d.search(label, true)}
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-brand hover:bg-brand-soft disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {d.stale && !d.loading && <p role="status" className="mt-3 text-xs text-muted-foreground">Search your updated text to refresh these results.</p>}
      {d.loading && <p role="status" className="mt-3 text-xs text-muted-foreground">Updating places and checking where they fit…</p>}
      {d.error && <p role="alert" className="mt-3 text-sm text-sev-c">{d.error}</p>}
      {r?.note && <p className="mt-2.5 text-xs text-muted-foreground">{r.note}</p>}

      {d.loading && !r ? (
        <div className="-mx-5 mt-3 flex gap-3 overflow-hidden px-5">
          {[0, 1].map((i) => (
            <div key={i} className="h-80 w-[82%] shrink-0 animate-pulse rounded-3xl bg-muted sm:w-72" />
          ))}
        </div>
      ) : (
        r &&
        r.results.length > 0 && (
          <ul ref={list} className={cn("-mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:thin]", d.loading && "opacity-50")}>
            {r.results.map((res, i) => (
              <ResultCard
                key={res.stop.key}
                r={res}
                index={i}
                best={i === 0 && r.results.length > 1 && !res.closed && res.conflicts.length === 0}
                active={d.selected === res.stop.key}
                busy={busy || d.loading || d.stale || Boolean(d.error)}
                onSelect={() => d.select(res.stop.key)}
                onAdd={() => onAdd(res)}
              />
            ))}
          </ul>
        )
      )}
    </section>
  );
}
