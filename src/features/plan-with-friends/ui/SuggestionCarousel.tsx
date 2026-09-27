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
      <div className="tr-carousel tr-carousel--loading" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse" />
        ))}
        <span className="sr-only">
          <Loader2 aria-hidden /> Finding places…
        </span>
      </div>
    );
  }
  if (error) return <p className="ed-alert">{error}</p>;
  if (!items.length) return emptyText ? <p className="ed-small ed-muted">{emptyText}</p> : null;

  return (
    <ul className="tr-carousel" aria-label="Suggested places">
      {items.map((item) => {
        const added = addedKeys.has(item.key);
        return (
          <li key={item.key}>
            <PlaceThumb stop={item.stop} className="tr-carousel-thumb" />
            <div className="tr-carousel-content">
              <p className="tr-carousel-name">{item.name}</p>
              <p className="tr-carousel-meta">{[item.category, item.area].filter(Boolean).join(" · ")}</p>
              {item.crowdHint && <p className="tr-carousel-meta">{item.crowdHint}</p>}
              {item.why && <p className="tr-carousel-why">{item.why}</p>}
              <button
                type="button"
                onClick={() => onAdd(item)}
                disabled={added}
                className="ed-btn ed-small"
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
