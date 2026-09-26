"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import type { StartPoint } from "../core/types";
import { PlaceSearch } from "./PlaceSearch";

export function StartPointCard({ start, onSet }: { start: StartPoint | null | undefined; onSet: (point: { lat: number; lon: number } | null) => void }) {
  const [editing, setEditing] = useState(false);
  const open = editing || !start;
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <MapPin className="size-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold">Where are you starting from?</h2>
      </div>
      {!open && start ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">{start.area}</span>
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">
            change
          </button>
          <button type="button" onClick={() => onSet(null)} className="text-xs text-muted-foreground hover:text-foreground">
            clear
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="mb-2 text-xs text-muted-foreground">Friends only see your area (like &ldquo;near Astor Pl&rdquo;), never the exact spot. It&apos;s used to pick a start that&apos;s fair for everyone.</p>
          <PlaceSearch
            forStart
            chosen={new Set()}
            onPick={(stop) => {
              setEditing(false);
              onSet({ lat: stop.lat, lon: stop.lon });
            }}
          />
        </div>
      )}
    </section>
  );
}
