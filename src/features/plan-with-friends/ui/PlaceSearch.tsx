"use client";

import { Check, Loader2, MapPin, Search, Sparkles } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { APP_API, ATTRACTIONS, type StopInput } from "../bridge/index";
import { cn, stopFromAttraction } from "../bridge/ui";

interface Result {
  key: string;
  name: string;
  detail: string;
  source: "catalog" | "osm";
  stop: StopInput;
}

const POPULAR_IDS = ["central-park", "met", "brooklyn-bridge", "high-line", "empire-state", "moma", "chelsea-market", "dumbo"];
const POPULAR = POPULAR_IDS.flatMap((id) => ATTRACTIONS.filter((a) => a.id === id));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** Type a name, see real places with their address, pick one. Falls back to a map lookup. */
export function PlaceSearch({
  chosen,
  disabled,
  onPick,
  forStart = false,
  initialQuery = "",
}: {
  chosen: Set<string>;
  disabled?: boolean;
  onPick: (stop: StopInput) => void;
  /** Picking where you set off from: include subway stations, skip the popular sights. */
  forStart?: boolean;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [found, setFound] = useState<{ q: string; results: Result[] }>({ q: "", results: [] });
  const [active, setActive] = useState(0);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const q = query.trim();
  const results = found.q === q ? found.results : [];
  const searching = q.length >= 2 && found.q !== q;

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/trips/places?q=${encodeURIComponent(q)}${forStart ? "&for=start" : ""}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((body: { results: Result[] }) => {
          setFound({ q, results: body.results });
          setActive(0);
        })
        .catch(() => {
          if (!controller.signal.aborted) setFound({ q, results: [] });
        });
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [q, forStart]);

  function pick(stop: StopInput) {
    setQuery("");
    setError(null);
    onPick(stop);
  }

  async function locate() {
    if (q.length < 2) return;
    setLocating(true);
    setError(null);
    try {
      const res = await fetch(`${APP_API.resolve}?q=${encodeURIComponent(q)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't find that place.");
      pick({ key: `place-${slug(q)}`, name: q, lat: body.lat, lon: body.lon, visitMin: 60, attractionId: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't find that place.");
    } finally {
      setLocating(false);
    }
  }

  const rows = results.length + 1;
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % rows);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + rows) % rows);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Wait for this query's results so a quick Enter doesn't fall through to the map lookup.
      if (searching) return;
      if (active < results.length) pick(results[active].stop);
      else locate();
    }
  }

  return (
    <div>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          disabled={disabled}
          autoFocus
          placeholder={forStart ? "Your neighborhood, station or address…" : "Search a restaurant, museum, bar, park…"}
          aria-label={forStart ? "Search for where you are starting from" : "Search for a place to suggest"}
          role="combobox"
          aria-expanded={q.length >= 2}
          aria-controls={listId}
          aria-activedescendant={q.length >= 2 ? `${listId}-${active}` : undefined}
          className="w-full rounded-full border border-border bg-card py-2.5 pr-10 pl-10 text-sm outline-none transition placeholder:text-muted-foreground focus:border-brand focus:ring-4 focus:ring-brand/10"
        />
        {searching && <Loader2 aria-hidden className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {q.length >= 2 ? (
        <ul id={listId} role="listbox" className="mt-2 overflow-hidden rounded-2xl border border-border bg-popover text-sm shadow-sm">
          {results.map((r, i) => {
            const added = chosen.has(r.stop.key);
            return (
              <li key={r.key} id={`${listId}-${i}`} role="option" aria-selected={active === i}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(r.stop)}
                  className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left transition", active === i ? "bg-accent" : "hover:bg-accent")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{r.name}</span>
                      {r.source === "catalog" && <Sparkles aria-label="Roam pick" className="size-3.5 shrink-0 text-brand" />}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
                  </span>
                  {added ? <span className="flex shrink-0 items-center gap-1 text-xs text-brand"><Check className="size-3.5" aria-hidden /> added · +1 vote</span> : null}
                </button>
              </li>
            );
          })}
          {searching && results.length === 0 && <li className="px-4 py-2.5 text-xs text-muted-foreground">Searching…</li>}
          {!searching && results.length === 0 && <li className="px-4 py-2.5 text-xs text-muted-foreground">No named places match. Try the map search below.</li>}
          {!searching && (
          <li id={`${listId}-${results.length}`} role="option" aria-selected={active === results.length}>
            <button
              type="button"
              onMouseEnter={() => setActive(results.length)}
              onClick={locate}
              disabled={locating}
              className={cn("flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left text-muted-foreground transition disabled:opacity-50", active === results.length ? "bg-accent" : "hover:bg-accent")}
            >
              {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
              Search the map for &ldquo;{q}&rdquo; (addresses too)
            </button>
          </li>
          )}
        </ul>
      ) : forStart ? null : (
        <div className="mt-3">
          <p className="mb-2 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">Popular</p>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => pick(stopFromAttraction(a))}
                className={cn("rounded-full border px-3 py-1 text-xs transition", chosen.has(a.id) ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-muted")}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
