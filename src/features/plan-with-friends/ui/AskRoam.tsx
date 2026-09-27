"use client";

import { ArrowRight, Loader2, X } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import type { StopInput } from "../bridge/index";
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
    <section className="ed-panel tr-ask">
      <form onSubmit={ask} className="ed-prompt tr-ask-box">
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
        />
        <div className="tr-ask-foot">
          <span className="ed-small ed-muted">Ask Roam: it knows your times, meeting spot and votes</span>
          <button type="submit" disabled={busy || text.trim().length < 3} className="ed-btn">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {busy ? "Thinking" : "Ask"}
            {!busy && <ArrowRight aria-hidden />}
          </button>
        </div>
      </form>
      {(busy || error || result) && (
        <div className="tr-ask-reply">
          {result && (
            <button type="button" aria-label="Dismiss" onClick={() => setResult(null)} className="tr-close">
              <X aria-hidden />
            </button>
          )}
          {result && (
            <p className="ed-small tr-ask-text">
              {result.reply}
              {!result.usedAi && <span className="ed-muted">Roam&apos;s AI isn&apos;t available right now, so these match your words.</span>}
            </p>
          )}
          <SuggestionCarousel items={result?.items ?? []} addedKeys={addedKeys} onAdd={(item) => onAdd(item.stop)} loading={busy} error={error} emptyText="Nothing matched. Try other words." />
        </div>
      )}
    </section>
  );
}
