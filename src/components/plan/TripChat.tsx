"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Loader2, RotateCcw } from "lucide-react";
import type { ChatReply } from "@/lib/discover/chat";
import type { DiscoverResponse } from "@/lib/discover/types";
import type { DayPlan } from "@/lib/plan/types";
import { clock, duration } from "@/lib/plan/time";
import { ResultCard, type Discover } from "./Discover";

type Message = { id: number; role: "user" | "assistant"; text: string; reply?: ChatReply; tripKey: string };
const starters = [
  { label: "Find food", message: "Help me choose something to eat along my trip" },
  { label: "A café break", message: "Find a café for a break along my route" },
  { label: "Something to explore", message: "Suggest something interesting that fits my trip" },
];

export function TripChat({
  plan,
  discover,
  planning,
  onApply,
  onReply,
}: {
  plan: DayPlan;
  discover: Discover;
  planning: boolean;
  onApply: (plan: DayPlan) => void;
  /** The assistant answered: lets a closed panel show that something's waiting. */
  onReply?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<{ text: string; action?: { name: "preview_place"; index: number }; tripKey: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Results searched on top of a proposed change stay good for the trip before and after it's applied.
  const [found, setFound] = useState<{ data: DiscoverResponse; tripKeys: string[] } | null>(null);
  const [undo, setUndo] = useState<{ before: DayPlan; after: string } | null>(null);
  const [applied, setApplied] = useState<number[]>([]);
  const viewport = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const tripKey = JSON.stringify(plan.request);
  const disabled = busy || planning;
  const foundCurrent = found?.tripKeys.includes(tripKey) ?? false;
  const offers = foundCurrent ? found!.data.results : [];

  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);
  useEffect(() => () => { controller.current?.abort(); sequence.current++; }, []);
  // A trip edited elsewhere invalidates any pending answer about the old day.
  const latestTrip = useRef(tripKey);
  useEffect(() => { latestTrip.current = tripKey; }, [tripKey]);

  async function send(text: string, action?: { name: "preview_place"; index: number }) {
    if (disabled || !text.trim()) return;
    const id = ++sequence.current;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    setMessages((list) => [...list, { id: id * 2, role: "user", text, tripKey }]);
    setLastAttempt({ text, action, tripKey });
    setDraft(""); setBusy(true); setError(null);
    try {
      const res = await fetch("/api/trip-chat", {
        method: "POST", headers: { "content-type": "application/json" }, signal: abort.signal,
        body: JSON.stringify({
          request: plan.request, message: text, action,
          history: messages.slice(-20).map((m) => ({ role: m.role, text: m.text.slice(0, 2000) })),
          offers: offers.map((r) => ({ name: r.name, nextStops: r.nextStops })),
          previousArea: foundCurrent ? found!.data.area : undefined,
          previous: foundCurrent ? found!.data.intent : null,
        }),
      });
      const body = await res.json();
      if (id !== sequence.current) return;
      if (latestTrip.current !== tripKey) throw new Error("Your trip changed while I was working. Send your request again for the updated trip.");
      if (!res.ok) throw new Error(body.error ?? "Couldn't complete that request.");
      const reply = body as ChatReply;
      if (reply.discovery) {
        setFound({ data: reply.discovery, tripKeys: reply.proposal ? [tripKey, JSON.stringify(reply.proposal.plan.request)] : [tripKey] });
        discover.present(reply.discovery);
      }
      const listing = reply.discovery?.results.map((r, i) => `${i + 1}. ${r.name}`).join("; ");
      setMessages((list) => [...list, { id: id * 2 + 1, role: "assistant", text: reply.message + (listing ? `\nOptions: ${listing}` : ""), reply, tripKey }]);
      onReply?.();
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Couldn't send your message.");
    } finally { if (id === sequence.current) setBusy(false); }
  }

  function apply(message: Message) {
    const next = message.reply?.proposal?.plan;
    if (!next || message.tripKey !== tripKey || disabled) return;
    setUndo({ before: plan, after: JSON.stringify(next.request) });
    setApplied((ids) => [...ids, message.id]);
    discover.clear();
    onApply(next);
    setMessages((list) => [...list, { id: ++sequence.current * 2, role: "assistant", text: "Updated your trip. You can undo this change below.", tripKey: JSON.stringify(next.request) }]);
  }

  const newConversation = () => { controller.current?.abort(); sequence.current++; setMessages([]); setFound(null); setDraft(""); setError(null); setLastAttempt(null); discover.clear(); };
  const undoChange = () => { if (!undo) return; discover.clear(); onApply(undo.before); setUndo(null); setMessages((list) => [...list, { id: ++sequence.current * 2, role: "assistant", text: "Undid the last change. Your previous trip is restored.", tripKey: JSON.stringify(undo.before.request) }]); };
  const talking = messages.length > 0;

  // The conversation scrolls; the message box stays at the foot of the panel.
  return <section aria-label="Change your day" className="pl-chat">
    <div ref={viewport} className="pl-chat-scroll" role="log" aria-label="Trip conversation" aria-live="polite" aria-relevant="additions">
      {!talking && <>
        <p className="pl-dek mt-0">Find a place to eat, swap a stop or slow the day down. I&apos;ll check every change against your whole day.</p>
        <div className="pl-chips">{starters.map((c) => <button key={c.label} type="button" disabled={disabled} onClick={() => void send(c.message)} className="pl-chip">{c.label}</button>)}</div>
      </>}
      {messages.map((message, i) => {
        const reply = message.reply;
        const current = message.tripKey === tripKey;
        const activeResults = foundCurrent && reply?.discovery === found?.data;
        if (message.role === "user") return <p key={message.id} className="pl-msg user">{message.text}</p>;
        return <div key={message.id} className="grid gap-3">
          <p className="pl-msg">{reply?.message ?? message.text}</p>
          {reply?.discovery && <>
            <p className="pl-mono pl-muted">{reply.discovery.area.label} · {reply.discovery.source === "google" ? "Details from Google" : "OpenStreetMap, no ratings"}</p>
            {reply.discovery.note && <p className="pl-small pl-muted">{reply.discovery.note}</p>}
            {!activeResults && <p className="pl-small pl-muted">Earlier suggestions. Search again to check them against your current trip.</p>}
            <ul className="pl-reel">
              {reply.discovery.results.map((r, index) => <ResultCard key={r.stop.key} r={r} index={index} best={index === 0 && !r.conflicts.length && !r.closed} active={activeResults && discover.selected === r.stop.key} busy={disabled || !activeResults} onSelect={() => { if (activeResults) discover.select(r.stop.key); }} onAdd={() => void send(`Add option ${index + 1}: ${r.name}`, { name: "preview_place", index: index + 1 })} />)}
            </ul>
          </>}
          {reply?.proposal && <div className="pl-proposal">
            <p className="pl-h3" style={{ fontSize: "1.3em" }}>{reply.proposal.title}</p>
            <p className="pl-mono pl-muted">{duration(reply.proposal.plan.summary.travelMin)} travel · finishes {clock(reply.proposal.plan.summary.finishMin)}</p>
            <ol className="grid gap-0.5">{reply.proposal.plan.stops.map((s) => <li key={s.key}><span className="pl-mono pl-muted mr-2">{clock(s.startMin)}</span>{s.name}</li>)}</ol>
            {reply.proposal.warnings.map((w) => <p key={w} className="pl-flag">{w}</p>)}
            {applied.includes(message.id) ? <p className="pl-mono pl-red flex items-center gap-1"><Check className="size-4" aria-hidden /> Applied</p> : <div className="mt-1 flex flex-wrap gap-2">
              <button type="button" disabled={disabled || !current || i !== messages.length - 1} onClick={() => apply(message)} className="ed-btn">{reply.proposal.warnings.length ? "Apply with these conflicts" : "Apply change"}</button>
              <button type="button" disabled={disabled || i !== messages.length - 1} onClick={() => setMessages((list) => [...list, { id: ++sequence.current * 2, role: "assistant", text: "Kept your current trip. What would you like to try instead?", tripKey }])} className="ed-btn ed-btn--ghost">Keep current trip</button>
            </div>}
          </div>}
          {reply && i === messages.length - 1 && reply.choices.length > 0 && <div className="pl-chips">{reply.choices.map((c) => <button key={c.label} type="button" disabled={disabled} onClick={() => void send(c.message)} className="pl-chip">{c.label}</button>)}</div>}
        </div>;
      })}
      {busy && <p role="status" className="pl-mono pl-muted flex items-center gap-2"><Loader2 className="size-4 animate-spin" aria-hidden /> Looking for options…</p>}
      {error && <div role="alert" className="pl-flag flex-col"><p>{error}</p>{lastAttempt && <button type="button" disabled={disabled} onClick={() => void send(lastAttempt.text, lastAttempt.tripKey === tripKey ? lastAttempt.action : undefined)} className="pl-link">Try again</button>}</div>}
      {(talking || (undo && undo.after === tripKey)) && <p className="pl-mono flex flex-wrap gap-x-4">
        {undo && undo.after === tripKey && <button type="button" disabled={disabled} onClick={undoChange} className="pl-textbtn pl-red"><RotateCcw aria-hidden /> Undo last change</button>}
        {talking && <button type="button" disabled={disabled} onClick={newConversation} className="pl-textbtn pl-muted">New conversation</button>}
      </p>}
    </div>
    <form className="ed-prompt pl-composer" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
      <input aria-label="Describe a change to your day" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="‘Find pizza after the Met’" maxLength={600} />
      <button type="submit" disabled={disabled || !draft.trim()} aria-label="Send message" className="ed-btn">{busy ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowUp aria-hidden />}</button>
    </form>
  </section>;
}
