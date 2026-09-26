"use client";

import { useState } from "react";
import { Check, Loader2, MapPin, Plus, Search, Sparkles } from "lucide-react";
import { ATTRACTIONS, KIND_LABELS, searchAttractions, type Attraction, type AttractionKind } from "@/lib/plan/attractions";
import { KIND_COLOR } from "@/lib/plan/display";
import type { StopInput } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

export function stopFromAttraction(a: Attraction): StopInput {
  return { key: a.id, name: a.name, lat: a.lat, lon: a.lon, visitMin: a.visitMin, attractionId: a.id };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export function StopPicker({
  stops,
  suggestions,
  onAdd,
  onToggle,
  onInspect,
  full,
}: {
  stops: StopInput[];
  /** Picked for this traveler's interests and group; empty when there's nothing to go on. */
  suggestions: Attraction[];
  onAdd: (stop: StopInput) => void;
  onToggle: (a: Attraction) => void;
  onInspect: (a: Attraction) => void;
  full: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<AttractionKind | "all">("all");
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = new Set(stops.map((s) => s.key));
  const matches = searchAttractions(query, 5);
  const list = kind === "all" ? ATTRACTIONS : ATTRACTIONS.filter((a) => a.kind === kind);

  async function find() {
    const q = query.trim();
    if (q.length < 2 || full) return;
    setFinding(true);
    setError(null);
    try {
      const res = await fetch(`/api/resolve?q=${encodeURIComponent(q)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't find that place.");
      onAdd({ key: `place-${slug(q)}`, name: q, lat: body.lat, lon: body.lon, visitMin: 60, attractionId: null });
      setQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't find that place.");
    } finally {
      setFinding(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (matches[0] && !chosen.has(matches[0].id)) {
            onToggle(matches[0]);
            setQuery("");
          } else find();
        }}
        className="relative"
      >
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError(null);
          }}
          placeholder="Search a place, restaurant or address"
          aria-label="Search for a place to add"
          className="w-full rounded-full border border-border bg-card py-2.5 pr-4 pl-10 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-brand focus:ring-4 focus:ring-brand/10"
        />
      </form>

      {query.trim().length >= 2 && (
        <ul className="mt-2 overflow-hidden rounded-2xl border border-border bg-popover text-sm shadow-sm">
          {matches.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled={full && !chosen.has(a.id)}
                onClick={() => {
                  onToggle(a);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-accent disabled:opacity-50"
              >
                <span className="size-2 rounded-full" style={{ background: KIND_COLOR[a.kind] }} aria-hidden />
                <span className="font-medium">{a.name}</span>
                <span className="truncate text-muted-foreground">{a.area}</span>
                {chosen.has(a.id) ? <Check className="ml-auto size-4 text-brand" aria-label="Added" /> : <Plus className="ml-auto size-4" aria-hidden />}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={find}
              disabled={finding || full}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-muted-foreground transition hover:bg-accent disabled:opacity-50"
            >
              {finding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
              Find &ldquo;{query.trim()}&rdquo; on the map
            </button>
          </li>
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-sev-c">
          {error}
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="mt-5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Sparkles className="size-3.5 text-brand" aria-hidden /> Picked for you
          </h3>
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {suggestions.map((a) => (
              <li key={a.id} className="w-40 shrink-0">
                <div className="flex h-full flex-col rounded-2xl border border-brand/25 bg-brand-soft/50 p-3">
                  <button type="button" onClick={() => onInspect(a)} aria-haspopup="dialog" className="text-left">
                    <span className="block text-sm leading-snug font-medium hover:text-brand">{a.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: KIND_COLOR[a.kind] }} aria-hidden />
                      <span className="truncate">{a.area}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={full}
                    onClick={() => onToggle(a)}
                    className="mt-auto inline-flex items-center gap-1 self-start pt-2 text-xs font-medium text-brand hover:underline disabled:opacity-50"
                  >
                    <Plus className="size-3.5" aria-hidden /> Add
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Filter spots by kind">
        {(["all", ...Object.keys(KIND_LABELS)] as (AttractionKind | "all")[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
              kind === k ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {k !== "all" && <span className="size-1.5 rounded-full" style={{ background: KIND_COLOR[k] }} aria-hidden />}
            {k === "all" ? "Popular" : KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {list.map((a) => {
          const on = chosen.has(a.id);
          return (
            <li key={a.id}>
              <div
                className={cn(
                  "flex h-full w-full items-start gap-3 rounded-2xl border p-3 transition",
                  on ? "border-brand bg-brand-soft" : "border-border bg-card hover:border-foreground/20",
                )}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={on ? `Remove ${a.name} from your day` : `Add ${a.name} to your day`}
                  disabled={full && !on}
                  onClick={() => onToggle(a)}
                  className={cn(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full transition disabled:opacity-45",
                    on ? "bg-brand text-on-color" : "bg-muted text-muted-foreground hover:bg-foreground hover:text-background",
                  )}
                >
                  {on ? <Check className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
                </button>
                <button type="button" onClick={() => onInspect(a)} aria-haspopup="dialog" className="group min-w-0 flex-1 text-left">
                  <span className="block text-sm leading-snug font-medium group-hover:text-brand">{a.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: KIND_COLOR[a.kind] }} aria-hidden />
                    <span className="truncate">{a.area}</span>
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-muted-foreground">{a.blurb}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
