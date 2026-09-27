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
    <div className="tr-idea-panel">
      <div className="tr-idea-header">
        <span>{found ? (pick ? "This note names a place" : `Places for "${found.label}"`) : "Reading the note…"}</span>
        <button type="button" onClick={onClose} className="tr-idea-close">
          Close
        </button>
      </div>
      {pick ? (
        <div className="tr-idea-confirm">
          <PlaceThumb stop={pick.stop} className="tr-idea-thumb" />
          <div className="tr-idea-content">
            <p className="tr-idea-name">{pick.name}</p>
            <p className="tr-idea-meta">{[pick.category, pick.area].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="tr-idea-actions">
            <button type="button" onClick={() => onChoose(pick.stop, found!.authorId)} className="ed-btn ed-small">
              Add it
            </button>
            <button type="button" onClick={() => setBrowse(true)} className="tr-idea-alt">
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
      {found && !found.usedAi && <p className="tr-idea-note">Roam AI isn&apos;t available right now, so these match the note&apos;s words.</p>}
    </div>
  );
}
