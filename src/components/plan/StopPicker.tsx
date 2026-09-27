"use client";

import { useRef, useState } from "react";
import { Check, Loader2, MapPin, Plus, Search } from "lucide-react";
import { ATTRACTIONS, KIND_LABELS, searchAttractions, type Attraction, type AttractionKind } from "@/lib/plan/attractions";
import { catalogPhoto } from "@/lib/plan/photoUrls";
import { arrowKeys } from "./arrowKeys";
import type { StopInput } from "@/lib/plan/types";

export function stopFromAttraction(a: Attraction): StopInput {
  return {
    key: a.id,
    name: a.name,
    lat: a.lat,
    lon: a.lon,
    visitMin: a.visitMin,
    attractionId: a.id,
  };
}

type Filter = AttractionKind | "all" | "for-you";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

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
  // "For you" leads when the traveler's interests pick something out.
  const [kind, setKind] = useState<Filter>(() => (suggestions.length ? "for-you" : "all"));
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = new Set(stops.map((s) => s.key));
  const matches = searchAttractions(query, 5);
  const list =
    kind === "all" ? ATTRACTIONS : kind === "for-you" ? (suggestions.length ? suggestions : ATTRACTIONS) : ATTRACTIONS.filter((a) => a.kind === kind);

  async function find() {
    const q = query.trim();
    if (q.length < 2 || full) return;
    setFinding(true);
    setError(null);
    try {
      const res = await fetch(`/api/resolve?q=${encodeURIComponent(q)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't find that place.");
      onAdd({
        key: `place-${slug(q)}`,
        name: q,
        lat: body.lat,
        lon: body.lon,
        visitMin: 60,
        attractionId: null,
      });
      setQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't find that place.");
    } finally {
      setFinding(false);
    }
  }

  const matchList = useRef<HTMLUListElement>(null);
  const firstMatch = () => matchList.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();

  return (
    <div>
      <div className="pl-searchrow">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Enter never adds a guess: it moves to the matches to choose from, or looks up an address.
            if (matches.length) firstMatch();
            else find();
          }}
          className="pl-search"
        >
          <Search aria-hidden />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            placeholder="Search a place, restaurant or address"
            aria-label="Search for a place to add"
            aria-controls="place-matches"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && matches.length) {
                e.preventDefault();
                firstMatch();
              }
            }}
            className="pl-input"
          />
        </form>
        <label className="sr-only" htmlFor="place-kind">
          Show
        </label>
        <select id="place-kind" value={kind} onChange={(e) => setKind(e.target.value as Filter)} className="pl-select">
          {(["all", ...(suggestions.length ? ["for-you"] : []), ...Object.keys(KIND_LABELS)] as Filter[]).map((k) => (
            <option key={k} value={k}>
              {k === "all" ? "Popular" : k === "for-you" ? "For you" : KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {query.trim().length >= 2 && (
        <ul
          id="place-matches"
          ref={matchList}
          aria-label="Matching places"
          className="pl-matches"
          onKeyDown={(e) => {
            if (e.key === "Escape") document.querySelector<HTMLInputElement>('[aria-controls="place-matches"]')?.focus();
            else arrowKeys(e, "button", false);
          }}
        >
          {matches.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled={full && !chosen.has(a.id)}
                onClick={() => {
                  onToggle(a);
                  setQuery("");
                }}
              >
                {chosen.has(a.id) ? <Check className="pl-red" aria-label="Added" /> : <Plus aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="pl-mono pl-muted truncate">{a.area}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={find} disabled={finding || full} className="pl-muted">
              {finding ? <Loader2 className="animate-spin" aria-hidden /> : <MapPin aria-hidden />}
              Find &ldquo;{query.trim()}&rdquo; on the map
            </button>
          </li>
        </ul>
      )}
      {error && (
        <p role="alert" className="pl-flag mt-2">
          {error}
        </p>
      )}

      <ul className="pl-grid">
        {list.map((a) => (
          <PlaceCard key={a.id} a={a} on={chosen.has(a.id)} full={full} onToggle={onToggle} onInspect={onInspect} />
        ))}
      </ul>
    </div>
  );
}

/** One place: its photo (with the add button on it), name, kind and area, and a line about it. */
function PlaceCard({
  a,
  on,
  full,
  onToggle,
  onInspect,
}: {
  a: Attraction;
  on: boolean;
  full: boolean;
  onToggle: (a: Attraction) => void;
  onInspect: (a: Attraction) => void;
}) {
  const photo = catalogPhoto(a.id);
  return (
    <li className={on ? "pl-card on" : "pl-card"}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? `Remove ${a.name} from your day` : `Add ${a.name} to your day`}
        disabled={full && !on}
        onClick={() => onToggle(a)}
        className="pl-add"
      >
        {on ? <Check aria-hidden /> : <Plus aria-hidden />}
      </button>
      <button type="button" onClick={() => onInspect(a)} aria-haspopup="dialog" className="pl-card-open">
        <span className="pl-photo block">
          {photo ? (
            // Bundled Wikipedia photos; next/image would need the host allow-listed.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <span className="pl-photo-empty">
              <MapPin aria-hidden />
            </span>
          )}
        </span>
        <span className="pl-card-name">{a.name}</span>
        <span className="pl-card-meta pl-mono">
          {KIND_LABELS[a.kind].replace(/s$/, "")} · {a.area}
        </span>
      </button>
    </li>
  );
}
