"use client";

import { ChevronUp, Plus, X } from "lucide-react";
import { useState } from "react";
import type { StopInput } from "../bridge/index";
import { Button, cn } from "../bridge/ui";
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
      <li key={c.stop.key} className="border-t border-border py-3 first:border-t-0">
        <div className="flex items-center gap-3">
        <PlaceThumb stop={c.stop} className="size-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{c.stop.name}</p>
          {c.note && <p className="truncate text-xs text-muted-foreground italic">&ldquo;{c.note}&rdquo;</p>}
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center pl-1">
              {c.votes.map((v) =>
                trip.members[v] ? <AvatarBubble key={v} avatar={trip.members[v].avatar} name={trip.members[v].name} size="sm" className="-ml-1 size-5 text-[11px]" /> : null,
              )}
            </span>
            <span className="truncate">
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
          className={cn(
            "flex min-w-12 flex-col items-center rounded-xl border px-2 py-1.5 text-xs leading-tight tabular-nums transition active:scale-95 disabled:opacity-60",
            mine ? "border-brand bg-brand-soft text-brand" : "border-border bg-background hover:border-brand/50 hover:bg-muted",
          )}
        >
          <ChevronUp className="size-3.5" aria-hidden />
          <span className="text-sm font-bold">{c.votes.length}</span>
        </button>
        {canRemove && (
          <button
            type="button"
            aria-label={`Remove ${c.stop.name}`}
            title="Remove this place"
            onClick={() => (others > 0 ? setRemoving(c.stop.key) : onRemove(c.stop.key))}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
        </div>
        {removing === c.stop.key && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
            <span className="flex-1">
              {others} {others === 1 ? "other person" : "others"} voted for this. Remove it anyway?
            </span>
            <button type="button" onClick={() => { setRemoving(null); onRemove(c.stop.key); }} className="rounded-full bg-destructive px-3 py-1 font-medium text-white">
              Remove
            </button>
            <button type="button" onClick={() => setRemoving(null)} className="rounded-full border border-border px-3 py-1">
              Keep
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Places</h2>
        <span className="text-xs text-muted-foreground">Most votes go in the day · up to 10</span>
      </div>
      {trip.candidates.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No places yet. Suggest the first one.</p>
      ) : (
        <>
          <ul className="mt-1">{inDay.map((c) => row(c, true))}</ul>
          {waiting.length > 0 && (
            <>
              <p className="mt-3 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">Not in the day yet</p>
              <ul>{waiting.map((c) => row(c, false))}</ul>
            </>
          )}
        </>
      )}
      {memberId && !locked && !picking && (
        <Button variant="outline" className="mt-3 w-full border-dashed" onClick={() => setPicking(true)} disabled={full}>
          <Plus aria-hidden /> Suggest a place
        </Button>
      )}
      {picking && (
        <div className="mt-3 rounded-xl border border-border bg-background p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Suggest a place</span>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setPicking(false); setPreview(null); }}>
              Close
            </button>
          </div>
          {preview ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <PlaceThumb stop={preview} className="size-16" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{preview.name}</p>
                  <p className="text-xs text-muted-foreground">{existing(preview.key) ? `Already suggested · ${existing(preview.key)!.votes.length} vote${existing(preview.key)!.votes.length === 1 ? "" : "s"}` : "New suggestion"}</p>
                </div>
              </div>
              {!existing(preview.key) && (
                <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={140} placeholder="Why? (optional) e.g. best cookies in the city" aria-label="Why this place (optional)" className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand" />
              )}
              <div className="flex gap-2">
                <Button onClick={confirmPreview} className="rounded-full">
                  {existing(preview.key) ? "Upvote it" : "Add it"}
                </Button>
                <Button variant="outline" className="rounded-full" onClick={() => setPreview(null)}>
                  Back
                </Button>
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
