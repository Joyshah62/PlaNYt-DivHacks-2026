"use client";

import { ChevronUp, MapPin, Send } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import type { StopInput } from "../bridge/index";
import { cn } from "../bridge/ui";
import type { Trip } from "../core/types";
import { AvatarBubble } from "./Avatar";
import { IdeaToPlace } from "./IdeaToPlace";

function ago(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function IdeasPanel({
  trip,
  memberId,
  onPost,
  onVote,
  onToPlace,
  tripId,
}: {
  trip: Trip;
  memberId: string | null;
  onPost: (text: string) => Promise<unknown> | unknown;
  onVote: (ideaId: string, on: boolean) => void;
  onToPlace: (ideaId: string, stop: StopInput, authorId: string) => void;
  tripId: string;
}) {
  const [text, setText] = useState("");
  const [finding, setFinding] = useState<string | null>(null);
  const placeName = (key: string) => trip.candidates.find((c) => c.stop.key === key)?.stop.name ?? null;

  async function post(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    await onPost(t);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Ideas &amp; chat</h2>
        <span className="text-xs text-muted-foreground">Upvote, or turn one into a place</span>
      </div>
      <ul className="mt-2 flex max-h-96 flex-col gap-2 overflow-y-auto pr-1" aria-live="polite">
        {trip.ideas.length === 0 && <li className="py-3 text-center text-sm text-muted-foreground">No ideas yet. Throw out a thought, like &ldquo;dessert later?&rdquo;</li>}
        {trip.ideas.map((idea) => {
          const author = trip.members[idea.memberId];
          const mine = memberId !== null && idea.votes.includes(memberId);
          const linked = idea.placeKey ? placeName(idea.placeKey) : null;
          return (
            <li key={idea.id} className="rounded-xl border border-amber-200/10 bg-amber-100/5 p-2.5">
              <div className="flex gap-2.5">
                {author && <AvatarBubble avatar={author.avatar} name={author.name} size="sm" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{author?.name ?? "Someone"}</span> · {ago(idea.at)}
                  </p>
                  <p className="text-sm break-words">{idea.text}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {linked ? (
                      <span className="inline-flex items-center gap-1 text-brand">
                        <MapPin className="size-3" aria-hidden /> → added as {linked}
                      </span>
                    ) : (
                      memberId &&
                      !trip.lockedCode && (
                        <button type="button" onClick={() => setFinding(finding === idea.id ? null : idea.id)} className="text-brand hover:underline">
                          Turn into a place
                        </button>
                      )
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={mine}
                  aria-label={`${mine ? "Remove your upvote from" : "Upvote"} "${idea.text}"`}
                  disabled={!memberId}
                  onClick={() => onVote(idea.id, !mine)}
                  className={cn(
                    "flex h-fit min-w-10 flex-col items-center rounded-lg border px-1.5 py-1 text-[11px] leading-tight transition disabled:opacity-60",
                    mine ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-muted",
                  )}
                >
                  <ChevronUp className="size-3" aria-hidden />
                  <b>{idea.votes.length}</b>
                </button>
              </div>
              {finding === idea.id && memberId && (
                <IdeaToPlace
                  tripId={tripId}
                  memberId={memberId}
                  ideaId={idea.id}
                  addedKeys={new Set(trip.candidates.map((c) => c.stop.key))}
                  onClose={() => setFinding(null)}
                  onChoose={(stop, authorId) => {
                    setFinding(null);
                    onToPlace(idea.id, stop, authorId);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
      {memberId && (
        <form onSubmit={post} className="mt-3 flex items-center gap-2 rounded-full border border-border bg-background py-1 pr-1 pl-4 focus-within:border-brand">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder="Share a thought…" aria-label="Share a thought" className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none" />
          <button type="submit" disabled={!text.trim()} aria-label="Post" className="grid size-8 place-items-center rounded-full bg-foreground text-background transition disabled:opacity-40">
            <Send className="size-3.5" aria-hidden />
          </button>
        </form>
      )}
    </section>
  );
}
