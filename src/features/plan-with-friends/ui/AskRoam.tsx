"use client";

import { ArrowRight, Loader2, Sparkles, X } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import type { StopInput } from "../bridge/index";
import { Button } from "../bridge/ui";
import type { SuggestionItem } from "../core/suggestions";
import { tripApi } from "./client";
import { SuggestionCarousel } from "./SuggestionCarousel";

/** The landing page's "describe it" box, for the group: Gemini reads the room and suggests places to add. */
export function AskRoam({ tripId, memberId, addedKeys, onAdd }: { tripId: string; memberId: string; addedKeys: Set<string>; onAdd: (stop: StopInput) => unknown }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reply: string; items: SuggestionItem[]; usedAi: boolean } | null>(null);

  async function ask(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = text.trim();
    if (q.length < 3) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await tripApi<{ reply: string; items: SuggestionItem[]; usedAi: boolean }>(`/${tripId}/ask`, { memberId, text: q }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Roam couldn't answer that right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <form
        onSubmit={ask}
        className="rounded-3xl border border-border bg-card/95 p-2 shadow-[0_24px_60px_-24px_oklch(0_0_0/0.4)] transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={2}
          maxLength={600}
          placeholder="Something artsy in the afternoon, then dessert near where we meet…"
          aria-label="Ask Roam for places"
          className="w-full resize-none bg-transparent px-3 pt-2 pb-1 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-brand" aria-hidden /> Ask Roam: it knows your times, meeting spot and votes
          </span>
          <Button type="submit" disabled={busy || text.trim().length < 3} className="h-9 rounded-full bg-brand px-4 text-sm font-semibold text-on-color hover:bg-brand/90">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {busy ? "Thinking" : "Ask"}
            {!busy && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </div>
      </form>
      {(busy || error || result) && (
        <div className="relative rounded-2xl border border-brand/30 bg-brand-soft/30 p-3">
          {result && (
            <button type="button" aria-label="Dismiss" onClick={() => setResult(null)} className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground hover:text-foreground">
              <X className="size-3.5" aria-hidden />
            </button>
          )}
          {result && (
            <p className="mb-2 pr-6 text-sm">
              {result.reply}
              {!result.usedAi && <span className="block text-xs text-muted-foreground">Roam&apos;s AI isn&apos;t available right now, so these match your words.</span>}
            </p>
          )}
          <SuggestionCarousel items={result?.items ?? []} addedKeys={addedKeys} onAdd={(item) => onAdd(item.stop)} loading={busy} error={error} emptyText="Nothing matched. Try other words." />
        </div>
      )}
    </section>
  );
}
