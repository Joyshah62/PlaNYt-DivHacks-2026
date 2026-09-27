"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Binoculars,
  Coffee,
  Eye,
  Footprints,
  IceCreamCone,
  Landmark,
  Palette,
  Plus,
  Replace,
  ShoppingBag,
  Star,
  Trees,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import type { Category } from "@/lib/discover/categories";
import type { Area, DiscoverResponse, Result } from "@/lib/discover/types";
import { CROWD_LABEL } from "@/lib/plan/display";
import { clock, duration } from "@/lib/plan/time";
import type { DayPlan } from "@/lib/plan/types";

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
  activity: Footprints,
  landmark: Landmark,
};

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

// --- results ------------------------------------------------------------------------------

function Photo({ r }: { r: Result }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ name: r.name, lat: String(r.lat), lon: String(r.lon) });
    fetch(`/api/photo?${params}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ url?: string }>) : null))
      .then((p) => {
        if (!cancelled) setUrl(p?.url ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [r.name, r.lat, r.lon]);
  const Icon = ICON[r.category];
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />
  ) : (
    <span className="pl-photo-empty">
      <Icon aria-hidden />
    </span>
  );
}

function travelLine(r: Result): string {
  if (r.travelDelta >= 2) return `Adds about ${duration(r.travelDelta)} of travel.`;
  if (r.travelDelta <= -2) return `Saves about ${duration(-r.travelDelta)} of travel.`;
  return "No extra travel.";
}

/** A place the assistant found: its photo and letter (as on the map), the facts, and where it fits. */
export function ResultCard({ r, index, best, active, busy, onSelect, onAdd }: { r: Result; index: number; best: boolean; active: boolean; busy: boolean; onSelect: () => void; onAdd: () => void }) {
  const fits = r.startMin !== null && !r.closed;
  const actionLabel = r.action === "replace" ? `Replace ${r.replaceName}` : r.action === "meal" ? `Make it my ${r.stop.mealFor}` : "Add to my day";
  return (
    <li data-result={r.stop.key}>
      <article onClick={onSelect} data-active={active} className="pl-found">
        <div className="pl-photo">
          <Photo r={r} />
          <span className="pl-found-letter">{String.fromCharCode(65 + index)}</span>
          <span className="pl-tag pl-over">{r.kind}</span>
          {best && (
            <span className="pl-tag red absolute top-2 right-2 bg-(--paper)">
              <Star aria-hidden /> Best fit
            </span>
          )}
        </div>
        <div className="pl-found-body">
          <h3 className="pl-h3" style={{ fontSize: "1.3em" }}>
            {r.name}
          </h3>
          <p className="pl-mono pl-muted flex flex-wrap gap-x-3">
            <span>{r.rating !== null && r.reviews ? `${r.rating.toFixed(1)}★ (${r.reviews.toLocaleString("en-US")})` : "No ratings"}</span>
            {r.price && <span>{"$".repeat(r.price)}</span>}
            <span>{r.openUntil !== null ? `Open until ${clock(r.openUntil)}` : "Hours not listed"}</span>
          </p>

          {/* The part that's ours: what it does to the day, from the planner. */}
          <div className="pl-found-fit">
            {r.closed ? (
              <p className="pl-flag">
                <AlertTriangle aria-hidden /> Closed that day
              </p>
            ) : fits ? (
              <>
                <p>
                  {r.action === "replace" ? `Replaces ${r.replaceName}` : r.after ? `${r.conflicts.length ? "After" : "Fits after"} ${r.after}` : "First stop"}
                  <span className="pl-muted">
                    {" "}
                    · {clock(r.startMin!)}
                    {r.endMin !== null && ` – ${clock(r.endMin)}`}
                  </span>
                </p>
                <p className="pl-muted">
                  {travelLine(r)}
                  {r.conflicts.length === 0 && r.keeps.length > 0 && ` ${r.keeps[0]} still fits.`}
                </p>
                {r.conflicts.map((c) => (
                  <p key={c} className="pl-flag">
                    <AlertTriangle aria-hidden /> {c}
                  </p>
                ))}
              </>
            ) : (
              <p className="pl-muted">Couldn&apos;t fit it into the day.</p>
            )}
          </div>

          {(r.reasons.length > 0 || (r.crowdBand && fits)) && (
            <p className="flex flex-wrap gap-1">
              {r.reasons.map((why) => (
                <span key={why} className="pl-tag">
                  {why}
                </span>
              ))}
              {r.crowdBand && fits && <span className="pl-tag">{CROWD_LABEL[r.crowdBand]}</span>}
            </p>
          )}

          <div className="pl-found-actions">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              aria-pressed={active}
              aria-label={`Show ${r.name} on the map`}
              className="pl-icon"
              style={{ border: "1px solid var(--rule)", width: "2.9em", height: "auto" }}
            >
              <Eye aria-hidden />
            </button>
            <button
              type="button"
              disabled={busy || r.closed || !fits || r.nextStops.length > 10}
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="ed-btn"
            >
              {r.action === "replace" ? <Replace aria-hidden /> : <Plus aria-hidden />}
              <span>{actionLabel}</span>
            </button>
          </div>
        </div>
      </article>
    </li>
  );
}
