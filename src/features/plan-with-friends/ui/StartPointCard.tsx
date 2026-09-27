"use client";

import { LocateFixed, Loader2 } from "lucide-react";
import { useState } from "react";
import type { StartPoint } from "../core/types";
import { PlaceSearch } from "./PlaceSearch";

export function StartPointCard({
  start,
  onSet,
  added,
  total,
}: {
  start: StartPoint | null | undefined;
  onSet: (point: { lat: number; lon: number } | null) => void;
  added: number;
  total: number;
}) {
  const [editing, setEditing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = editing || !start;
  const count = `${added} of ${total} ${total === 1 ? "person has" : "people have"} added a start`;

  function locate() {
    if (!("geolocation" in navigator)) return setError("This browser can't share its location. Search instead.");
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setEditing(false);
        // The server rounds this to ~200 m and only ever shares the neighborhood.
        onSet({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location. Search for your neighborhood instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      {!open && start ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            📍 Near {start.area.replace(/^near /, "")} ·{" "}
            <button type="button" onClick={() => setEditing(true)} className="text-brand hover:underline">
              change
            </button>
          </span>
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Where are you coming from?</h2>
            <span className="text-xs text-muted-foreground">{count}</span>
          </div>
          <p className="mt-1 mb-2 text-xs text-muted-foreground">We&apos;ll use this to find a meetup spot that&apos;s fair for everyone. Friends only see your neighborhood.</p>
          <PlaceSearch
            forStart
            chosen={new Set()}
            onPick={(stop) => {
              setEditing(false);
              onSet({ lat: stop.lat, lon: stop.lon });
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium transition hover:border-brand hover:text-brand disabled:opacity-60"
            >
              {locating ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <LocateFixed className="size-3.5" aria-hidden />}
              Use my location
            </button>
            {start && (
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground">
                cancel
              </button>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </>
      )}
    </section>
  );
}
