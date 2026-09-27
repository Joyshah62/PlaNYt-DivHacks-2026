"use client";

import { Check, Loader2, Plus } from "lucide-react";
import type { SuggestionItem } from "../core/suggestions";
import { PlaceThumb } from "./PlaceThumb";

export interface SuggestionCarouselProps {
  items: SuggestionItem[];
  /** Keys already on the trip; those cards show "Added". */
  addedKeys: Set<string>;
  onAdd: (item: SuggestionItem) => void;
  loading?: boolean;
  error?: string | null;
  emptyText?: string;
  /** Label for the add button, e.g. "+ Add" or "Add to trip". */
  addLabel?: string;
}

/** A row of place cards to scroll through and add. Self-contained: give it items, it calls onAdd. */
export function SuggestionCarousel({ items, addedKeys, onAdd, loading = false, error = null, emptyText = "No places matched.", addLabel = "Add" }: SuggestionCarouselProps) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden py-1" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-52 w-44 shrink-0 animate-pulse rounded-2xl bg-muted" />
        ))}
        <span className="sr-only">
          <Loader2 aria-hidden /> Finding places…
        </span>
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!items.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:thin]" aria-label="Suggested places">
      {items.map((item) => {
        const added = addedKeys.has(item.key);
        return (
          <li key={item.key} className="flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <PlaceThumb stop={item.stop} className="h-24 w-full rounded-none" />
            <div className="flex flex-1 flex-col gap-0.5 p-2.5">
              <p className="line-clamp-2 text-sm leading-snug font-semibold">{item.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{[item.category, item.area].filter(Boolean).join(" · ")}</p>
              {item.crowdHint && <p className="text-[11px] text-muted-foreground">{item.crowdHint}</p>}
              {item.why && <p className="line-clamp-2 text-[11px] text-brand">{item.why}</p>}
              <button
                type="button"
                onClick={() => onAdd(item)}
                disabled={added}
                className="mt-auto inline-flex items-center justify-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition hover:bg-foreground/85 disabled:bg-brand-soft disabled:text-brand"
              >
                {added ? <Check className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
                {added ? "Added" : addLabel}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
