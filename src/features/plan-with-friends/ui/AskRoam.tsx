"use client";

import { ArrowRight, Loader2, Sparkles, X } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { APP_API, type AssistantResult, type StopInput } from "../bridge/index";
import { Button } from "../bridge/ui";

interface Outcome {
  reply: string;
  added: string[];
  unresolved: string[];
  choices: AssistantResult["choices"];
}

/** The landing page's "describe your day" box, for the group: what it finds becomes your suggestions. */
export function AskRoam({ onSuggest }: { onSuggest: (stop: StopInput) => Promise<unknown> | unknown }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function ask(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = text.trim();
    if (q.length < 3) return;
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      const res = await fetch(APP_API.assistant, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: q }) });
      const body = (await res.json()) as AssistantResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Roam couldn't answer that right now.");
      for (const stop of body.stops) await onSuggest(stop);
      setOutcome({ reply: body.reply, added: body.stops.map((s) => s.name), unresolved: body.unresolved, choices: body.choices.filter((c) => c.kind === "wish" && c.options.length > 0) });
      setText("");
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
          placeholder="Something artsy in the afternoon, then dessert in the Village…"
          aria-label="Describe what you'd like to do"
          className="w-full resize-none bg-transparent px-3 pt-2 pb-1 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-brand" aria-hidden /> Ask Roam: it adds places as your suggestions
          </span>
          <Button type="submit" disabled={busy || text.trim().length < 3} className="h-9 rounded-full bg-brand px-4 text-sm font-semibold text-on-color hover:bg-brand/90">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {busy ? "Thinking" : "Ask"}
            {!busy && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="px-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {outcome && (
        <div className="relative rounded-2xl border border-brand/30 bg-brand-soft/40 p-3 text-sm">
          <button type="button" aria-label="Dismiss" onClick={() => setOutcome(null)} className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" aria-hidden />
          </button>
          <p className="pr-6">{outcome.reply}</p>
          {outcome.added.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Added: {outcome.added.join(", ")}</p>}
          {outcome.unresolved.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Couldn&apos;t find: {outcome.unresolved.join(", ")}</p>}
          {outcome.choices.map((c) => (
            <div key={c.id} className="mt-2">
              <p className="text-xs font-semibold">For &ldquo;{c.title}&rdquo;, pick one:</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {c.options.map((o) => (
                  <button key={o.key} type="button" onClick={() => onSuggest(o)} className="rounded-full border border-border bg-card px-3 py-1 text-xs transition hover:border-brand">
                    {o.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
