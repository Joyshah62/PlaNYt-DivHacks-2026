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
    <section className="ed-panel">
      {!open && start ? (
        <div className="tr-panel-head">
          <span className="ed-small">
            📍 Near {start.area.replace(/^near /, "")} ·{" "}
            <button type="button" onClick={() => setEditing(true)} className="ed-link">
              change
            </button>
          </span>
          <span className="ed-mono ed-muted">{count}</span>
        </div>
      ) : (
        <>
          <div className="tr-panel-head">
            <h2 className="ed-h3">Where are you coming from?</h2>
            <span className="ed-mono ed-muted">{count}</span>
          </div>
          <p className="ed-small ed-muted tr-lede">We&apos;ll use this to find a meetup spot that&apos;s fair for everyone. Friends only see your neighborhood.</p>
          <PlaceSearch
            forStart
            chosen={new Set()}
            onPick={(stop) => {
              setEditing(false);
              onSet({ lat: stop.lat, lon: stop.lon });
            }}
          />
          <div className="tr-row tr-gap">
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="ed-btn ed-btn--ghost"
            >
              {locating ? <Loader2 className="animate-spin" aria-hidden /> : <LocateFixed aria-hidden />}
              Use my location
            </button>
            {start && (
              <button type="button" onClick={() => setEditing(false)} className="ed-link ed-small">
                cancel
              </button>
            )}
          </div>
          {error && <p role="alert" className="ed-alert tr-gap">{error}</p>}
        </>
      )}
    </section>
  );
}
