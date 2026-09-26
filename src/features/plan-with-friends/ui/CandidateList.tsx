"use client";

import { ChevronUp } from "lucide-react";
import { cn } from "../bridge/ui";
import { rankCandidates } from "../core/rank";
import type { Candidate, Trip } from "../core/types";

export function CandidateList({
  trip,
  memberId,
  locked,
  onVote,
}: {
  trip: Trip;
  memberId: string | null;
  locked: boolean;
  onVote: (stopKey: string, on: boolean) => void;
}) {
  const { inDay, waiting } = rankCandidates(trip);

  const row = (c: Candidate) => {
    const mine = memberId !== null && c.votes.includes(memberId);
    return (
      <li key={c.stop.key} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{c.stop.name}</p>
          <p className="text-xs text-muted-foreground">
            Added by {trip.members[c.addedBy]?.name ?? "someone"}
            {c.votes.length > 0 && ` · ${c.votes.map((v) => trip.members[v]?.avatar.emoji ?? "?").join(", ")}`}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={mine}
          aria-label={`${mine ? "Remove your vote for" : "Vote for"} ${c.stop.name}`}
          disabled={!memberId || locked}
          onClick={() => onVote(c.stop.key, !mine)}
          className={cn(
            "flex min-w-12 flex-col items-center rounded-lg border px-2 py-1 text-xs leading-tight tabular-nums transition disabled:opacity-60",
            mine ? "border-brand bg-brand-soft text-brand" : "border-border bg-background hover:bg-muted",
          )}
        >
          <ChevronUp className="size-3.5" aria-hidden />
          <span className="text-sm font-bold">{c.votes.length}</span>
        </button>
      </li>
    );
  };

  return (
    <div>
      <ul>{inDay.map(row)}</ul>
      {waiting.length > 0 && (
        <>
          <p className="mt-3 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">Not in the day yet</p>
          <ul>{waiting.map(row)}</ul>
        </>
      )}
    </div>
  );
}
