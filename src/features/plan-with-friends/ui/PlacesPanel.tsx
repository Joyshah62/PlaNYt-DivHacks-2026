"use client";

import { ChevronUp, Plus, X } from "lucide-react";
import { useState } from "react";
import type { StopInput } from "../bridge/index";
import { rankCandidates } from "../core/rank";
import { MAX_CANDIDATES, type Candidate, type Trip } from "../core/types";
import { AvatarBubble } from "./Avatar";
import { PlaceSearch } from "./PlaceSearch";
import { PlaceThumb } from "./PlaceThumb";

export function PlacesPanel({
  trip,
  memberId,
  locked,
  onVote,
  onSuggest,
  onRemove,
}: {
  trip: Trip;
  memberId: string | null;
  locked: boolean;
  onVote: (stopKey: string, on: boolean) => void;
  onSuggest: (stop: StopInput, note?: string | null) => void;
  onRemove: (stopKey: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState<StopInput | null>(null);
  const [why, setWhy] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const { inDay, waiting } = rankCandidates(trip);
  const full = trip.candidates.length >= MAX_CANDIDATES;

  const existing = (key: string) => trip.candidates.find((c) => c.stop.key === key) ?? null;
  const confirmPreview = () => {
    if (!preview) return;
    onSuggest(preview, why.trim() || null);
    setPreview(null);
    setWhy("");
    setPicking(false);
  };

  const row = (c: Candidate, inTheDay: boolean) => {
    const mine = memberId !== null && c.votes.includes(memberId);
    const adder = trip.members[c.addedBy];
    const canRemove = !locked && memberId !== null && c.addedBy === memberId;
    const others = c.votes.filter((v) => v !== memberId).length;
    return (
      <li key={c.stop.key} className="tr-places-item">
        <div className="tr-places-row">
        <PlaceThumb stop={c.stop} className="tr-places-thumb" />
        <div className="tr-places-content">
          <p className="tr-places-name">{c.stop.name}</p>
          {c.note && <p className="tr-places-note">&ldquo;{c.note}&rdquo;</p>}
          <div className="tr-places-meta">
            <span className="tr-places-voters">
              {c.votes.map((v) =>
                trip.members[v] ? <AvatarBubble key={v} avatar={trip.members[v].avatar} name={trip.members[v].name} size="sm" /> : null,
              )}
            </span>
            <span className="tr-places-added">
              {adder ? `added by ${adder.name}` : "added"}
              {inTheDay && " · in the day"}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-pressed={mine}
          aria-label={`${mine ? "Remove your vote for" : "Vote for"} ${c.stop.name}`}
          disabled={!memberId || locked}
          onClick={() => onVote(c.stop.key, !mine)}
          className="tr-places-vote"
        >
          <ChevronUp className="size-3.5" aria-hidden />
          <span className="tr-places-vote-count">{c.votes.length}</span>
        </button>
        {canRemove && (
          <button
            type="button"
            aria-label={`Remove ${c.stop.name}`}
            title="Remove this place"
            onClick={() => (others > 0 ? setRemoving(c.stop.key) : onRemove(c.stop.key))}
            className="tr-places-remove"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
        </div>
        {removing === c.stop.key && (
          <div className="tr-places-confirm">
            <span className="tr-places-confirm-text">
              {others} {others === 1 ? "other person" : "others"} voted for this. Remove it anyway?
            </span>
            <button type="button" onClick={() => { setRemoving(null); onRemove(c.stop.key); }} className="ed-btn ed-small">
              Remove
            </button>
            <button type="button" onClick={() => setRemoving(null)} className="ed-btn ed-btn--ghost ed-small">
              Keep
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <section className="ed-panel">
      <div className="tr-places-header">
        <h2 className="ed-h3">Places</h2>
        <span className="tr-places-hint">Most votes go in the day · up to 10</span>
      </div>
      {trip.candidates.length === 0 ? (
        <p className="tr-places-empty">No places yet. Suggest the first one.</p>
      ) : (
        <>
          <ul className="tr-places-list">{inDay.map((c) => row(c, true))}</ul>
          {waiting.length > 0 && (
            <>
              <p className="tr-places-section-label">Not in the day yet</p>
              <ul className="tr-places-list">{waiting.map((c) => row(c, false))}</ul>
            </>
          )}
        </>
      )}
      {memberId && !locked && !picking && (
        <button type="button" className="ed-btn ed-btn--ghost ed-btn--block tr-places-add" onClick={() => setPicking(true)} disabled={full}>
          <Plus className="size-4" aria-hidden /> Suggest a place
        </button>
      )}
      {picking && (
        <div className="tr-places-picker">
          <div className="tr-places-picker-header">
            <span>Suggest a place</span>
            <button type="button" className="tr-places-picker-close" onClick={() => { setPicking(false); setPreview(null); }}>
              Close
            </button>
          </div>
          {preview ? (
            <div className="tr-places-preview">
              <div className="tr-places-preview-row">
                <PlaceThumb stop={preview} className="tr-places-preview-thumb" />
                <div className="tr-places-preview-info">
                  <p className="tr-places-preview-name">{preview.name}</p>
                  <p className="tr-places-preview-status">{existing(preview.key) ? `Already suggested · ${existing(preview.key)!.votes.length} vote${existing(preview.key)!.votes.length === 1 ? "" : "s"}` : "New suggestion"}</p>
                </div>
              </div>
              {!existing(preview.key) && (
                <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={140} placeholder="Why? (optional) e.g. best cookies in the city" aria-label="Why this place (optional)" className="tr-places-note-input" />
              )}
              <div className="tr-places-preview-actions">
                <button type="button" className="ed-btn" onClick={confirmPreview}>
                  {existing(preview.key) ? "Upvote it" : "Add it"}
                </button>
                <button type="button" className="ed-btn ed-btn--ghost" onClick={() => setPreview(null)}>
                  Back
                </button>
              </div>
            </div>
          ) : (
            <PlaceSearch chosen={new Set(trip.candidates.map((c) => c.stop.key))} disabled={full} onPick={setPreview} />
          )}
        </div>
      )}
    </section>
  );
}
