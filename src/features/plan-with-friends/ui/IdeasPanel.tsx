"use client";

import { ChevronUp, MapPin, Send } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import type { StopInput } from "../bridge/index";
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
    <section className="ed-panel">
      <div className="tr-ideas-header">
        <h2 className="ed-h3">Ideas &amp; chat</h2>
        <span className="tr-ideas-hint">Upvote, or turn one into a place</span>
      </div>
      <ul className="tr-ideas-list" aria-live="polite">
        {trip.ideas.length === 0 && <li className="tr-ideas-empty">No ideas yet. Throw out a thought, like &ldquo;dessert later?&rdquo;</li>}
        {trip.ideas.map((idea) => {
          const author = trip.members[idea.memberId];
          const mine = memberId !== null && idea.votes.includes(memberId);
          const linked = idea.placeKey ? placeName(idea.placeKey) : null;
          return (
            <li key={idea.id} className="tr-idea-item">
              <div className="tr-idea-item-head">
                {author && <AvatarBubble avatar={author.avatar} name={author.name} size="sm" />}
                <div className="tr-idea-item-body">
                  <p className="tr-idea-item-meta">
                    <span className="tr-idea-item-author">{author?.name ?? "Someone"}</span> · {ago(idea.at)}
                  </p>
                  <p className="tr-idea-item-text">{idea.text}</p>
                  <div className="tr-idea-item-action">
                    {linked ? (
                      <span className="tr-idea-item-linked">
                        <MapPin className="size-3" aria-hidden /> → added as {linked}
                      </span>
                    ) : (
                      memberId &&
                      !trip.lockedCode && (
                        <button type="button" onClick={() => setFinding(finding === idea.id ? null : idea.id)} className="tr-idea-item-toplace">
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
                  className="tr-idea-vote"
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
        <form onSubmit={post} className="tr-ideas-form">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder="Share a thought…" aria-label="Share a thought" className="tr-ideas-input" />
          <button type="submit" disabled={!text.trim()} aria-label="Post" className="tr-ideas-submit">
            <Send className="size-3.5" aria-hidden />
          </button>
        </form>
      )}
    </section>
  );
}
