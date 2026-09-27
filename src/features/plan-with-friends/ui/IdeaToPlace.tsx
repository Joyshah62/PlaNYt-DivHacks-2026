"use client";

import { useEffect, useState } from "react";
import type { StopInput } from "../bridge/index";
import type { SuggestionItem } from "../core/suggestions";
import { tripApi } from "./client";
import { PlaceThumb } from "./PlaceThumb";
import { SuggestionCarousel } from "./SuggestionCarousel";

interface Found {
  mode: "confirm" | "choose";
  label: string;
  items: SuggestionItem[];
  usedAi: boolean;
  authorId: string;
}

/** Reads a chat note with Gemini and offers matching places; the chosen one is credited to the note's author. */
export function IdeaToPlace({
  tripId,
  memberId,
  ideaId,
  addedKeys,
  onChoose,
  onClose,
}: {
  tripId: string;
  memberId: string;
  ideaId: string;
  addedKeys: Set<string>;
  onChoose: (stop: StopInput, authorId: string) => void;
  onClose: () => void;
}) {
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browse, setBrowse] = useState(false);

  useEffect(() => {
    let live = true;
    tripApi<Found>(`/${tripId}/ideas/suggest`, { memberId, ideaId }).then(
      (f) => live && setFound(f),
      (e: unknown) => live && setError(e instanceof Error ? e.message : "Couldn't read that note right now."),
    );
    return () => {
      live = false;
    };
  }, [tripId, memberId, ideaId]);

  const pick = found?.mode === "confirm" && !browse ? found.items[0] : null;
  return (
    <div className="mt-2 rounded-xl border border-border bg-background p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">{found ? (pick ? "This note names a place" : `Places for “${found.label}”`) : "Reading the note…"}</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          Close
        </button>
      </div>
      {pick ? (
        <div className="flex items-center gap-3">
          <PlaceThumb stop={pick.stop} className="size-14" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{pick.name}</p>
            <p className="truncate text-xs text-muted-foreground">{[pick.category, pick.area].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => onChoose(pick.stop, found!.authorId)} className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
              Add it
            </button>
            <button type="button" onClick={() => setBrowse(true)} className="text-[11px] text-muted-foreground hover:text-foreground">
              Not this one
            </button>
          </div>
        </div>
      ) : (
        <SuggestionCarousel
          items={found?.items ?? []}
          addedKeys={addedKeys}
          loading={!found && !error}
          error={error}
          onAdd={(item) => onChoose(item.stop, found!.authorId)}
          emptyText="Nothing nearby matched that note."
        />
      )}
      {found && !found.usedAi && <p className="mt-1 text-[11px] text-muted-foreground">Roam&apos;s AI isn&apos;t available right now, so these match the note&apos;s words.</p>}
    </div>
  );
}
