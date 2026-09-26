"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, Check, ChevronDown, Loader2, MessageCircle, RotateCcw } from "lucide-react";
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
  composerTarget,
  onEngage,
}: {
  plan: DayPlan;
  discover: Discover;
  planning: boolean;
  onApply: (plan: DayPlan) => void;
  /** Where the message box goes: the panel's sticky footer, so it's always in reach. Inline when absent. */
  composerTarget?: HTMLElement | null;
  /** A message was sent: the conversation should come into view. */
  onEngage?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<{ text: string; action?: { name: "preview_place"; index: number }; tripKey: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  // Results searched on top of a proposed change stay good for the trip before and after it's applied.
  const [found, setFound] = useState<{ data: DiscoverResponse; tripKeys: string[] } | null>(null);
  const [undo, setUndo] = useState<{ before: DayPlan; after: string } | null>(null);
  const [applied, setApplied] = useState<number[]>([]);
  const viewport = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
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
    setDraft(""); setBusy(true); setError(null); setOpen(true);
    onEngage?.();
    // The box sits at the bottom of the panel; bring the conversation up to meet it.
    window.requestAnimationFrame(() => section.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
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

  const composer = <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
    <input aria-label="Describe a change to your day" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Try ‘find pizza after the Met’" maxLength={600} className="neo-inset h-11 min-w-0 flex-1 rounded-full px-4 text-sm outline-none focus:outline-none focus:ring-0 bg-transparent caret-brand" />
    <button type="submit" disabled={disabled || !draft.trim()} aria-label="Send message" className="neo-primary grid size-11 shrink-0 place-items-center rounded-full disabled:opacity-40">{busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}</button>
  </form>;

  return <section ref={section} aria-label="Change your day" className="neo-raised mt-5 scroll-mb-24 overflow-hidden rounded-2xl">
    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="trip-chat-body" className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
      <span className="neo-inset grid size-9 place-items-center rounded-full text-brand"><MessageCircle className="size-4" aria-hidden /></span>
      <span className="flex-1"><span className="block text-sm font-semibold">Change your day</span><span className="text-xs text-muted-foreground">Find a place to eat, swap a stop or slow things down.</span></span>
      <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
    </button>
    <div id="trip-chat-body" hidden={!open}>
      <div ref={viewport} className="max-h-[55dvh] space-y-4 overflow-y-auto overscroll-contain p-4" role="log" aria-label="Trip conversation" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && <div className="flex flex-wrap gap-2">{starters.map((c) => <button key={c.label} type="button" disabled={disabled} onClick={() => void send(c.message)} className="neo-control rounded-full px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-40">{c.label}</button>)}</div>}
        {messages.map((message, i) => {
          const reply = message.reply;
          const current = message.tripKey === tripKey;
          const activeResults = foundCurrent && reply?.discovery === found?.data;
          return <div key={message.id} className={message.role === "user" ? "neo-raised ml-8 rounded-2xl px-3.5 py-2.5 text-sm" : "space-y-3"}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{reply?.message ?? message.text}</p>
            {reply?.discovery && <>
              <p className="text-[11px] text-muted-foreground">{reply.discovery.area.label} · {reply.discovery.source === "google" ? "Place details from Google" : "OpenStreetMap · ratings unavailable"}</p>
              {reply.discovery.note && <p className="text-xs text-muted-foreground">{reply.discovery.note}</p>}
              {!activeResults && <p className="text-xs text-muted-foreground">Earlier suggestions. Search again to check them against your current trip.</p>}
              <ul className="flex snap-x gap-3 overflow-x-auto pb-3">
                {reply.discovery.results.map((r, index) => <ResultCard key={r.stop.key} r={r} index={index} best={index === 0 && !r.conflicts.length && !r.closed} active={activeResults && discover.selected === r.stop.key} busy={disabled || !activeResults} onSelect={() => { if (activeResults) discover.select(r.stop.key); }} onAdd={() => void send(`Add option ${index + 1}: ${r.name}`, { name: "preview_place", index: index + 1 })} />)}
              </ul>
            </>}
            {reply?.proposal && <div className="neo-inset rounded-2xl p-3.5 space-y-2">
              <p className="text-sm font-semibold">{reply.proposal.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{duration(reply.proposal.plan.summary.travelMin)} travel · finishes {clock(reply.proposal.plan.summary.finishMin)}</p>
              <ol className="mt-2 space-y-1 text-xs">{reply.proposal.plan.stops.map((s) => <li key={s.key}>{clock(s.startMin)} · {s.name}</li>)}</ol>
              {reply.proposal.warnings.map((w) => <p key={w} className="mt-2 text-xs text-sev-c">{w}</p>)}
              {applied.includes(message.id) ? <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand"><Check className="size-3" /> Applied</p> : <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={disabled || !current || i !== messages.length - 1} onClick={() => apply(message)} className="neo-primary rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-40">{reply.proposal.warnings.length ? "Apply with these conflicts" : "Apply change"}</button>
                <button type="button" disabled={disabled || i !== messages.length - 1} onClick={() => setMessages((list) => [...list, { id: ++sequence.current * 2, role: "assistant", text: "Kept your current trip. What would you like to try instead?", tripKey }])} className="neo-control rounded-full px-3.5 py-1.5 text-xs font-medium disabled:opacity-40">Keep current trip</button>
              </div>}
            </div>}
            {reply && i === messages.length - 1 && <div className="flex flex-wrap gap-2">{reply.choices.map((c) => <button key={c.label} type="button" disabled={disabled} onClick={() => void send(c.message)} className="neo-control rounded-full px-3 py-1.5 text-xs font-medium text-brand disabled:opacity-40">{c.label}</button>)}</div>}
          </div>;
        })}
        {busy && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Looking for options…</p>}
        {error && <div role="alert" className="text-sm text-sev-c"><p>{error}</p>{lastAttempt && <button type="button" disabled={disabled} onClick={() => void send(lastAttempt.text, lastAttempt.tripKey === tripKey ? lastAttempt.action : undefined)} className="neo-control mt-2 rounded-full px-3 py-1 text-xs text-foreground disabled:opacity-40">Try again</button>}</div>}
      </div>
      {messages.length > 0 && <button type="button" disabled={disabled} onClick={() => { controller.current?.abort(); sequence.current++; setMessages([]); setFound(null); setDraft(""); setError(null); setLastAttempt(null); discover.clear(); }} className="mx-4 mb-3 text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-40">New conversation</button>}
      {undo && undo.after === tripKey && <button type="button" disabled={disabled} onClick={() => { discover.clear(); onApply(undo.before); setUndo(null); setMessages((list) => [...list, { id: ++sequence.current * 2, role: "assistant", text: "Undid the last change. Your previous trip is restored.", tripKey: JSON.stringify(undo.before.request) }]); }} className="neo-control mx-4 mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-brand"><RotateCcw className="size-3" aria-hidden /> Undo last trip change</button>}
      {!composerTarget && <div className="border-t border-border/60 p-3">{composer}</div>}
    </div>
    {composerTarget && createPortal(composer, composerTarget)}
  </section>;
}
