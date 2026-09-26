"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore, type SubmitEvent } from "react";
import { stopFromAttraction, StopPicker } from "../bridge/ui";
import { Button } from "../bridge/ui";
import { Input } from "../bridge/ui";
import type { StopInput } from "../bridge/index";
import { tripApi, TripApiError } from "./client";
import { clearIdentity, parseIdentity, readIdentityRaw, storeIdentity, subscribeIdentity, type TripIdentity } from "./local";
import { MAX_CANDIDATES, type Trip } from "../core/types";
import { CandidateList } from "./CandidateList";
import { DraftDay } from "./DraftDay";
import { useDraftPlan } from "./useDraftPlan";

const POLL_MS = 4000;

export function TripView({ id }: { id: string }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [missing, setMissing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [picking, setPicking] = useState(false);
  const [sessionIdentity, setSessionIdentity] = useState<TripIdentity | null>(null);
  const [copied, setCopied] = useState(false);

  const raw = useSyncExternalStore(subscribeIdentity, () => readIdentityRaw(id), () => "");
  const identity = parseIdentity(raw) ?? sessionIdentity;
  const memberId = identity && trip && identity.memberId in trip.members ? identity.memberId : null;
  const locked = !!trip?.lockedCode;
  const draft = useDraftPlan(trip);
  const mine = !!memberId && !!trip?.consensus.confirmed.includes(memberId);

  const refresh = useCallback(
    () =>
      tripApi<Trip>(`/${id}`).then(
        (next) => {
          setTrip(next);
          setOffline(false);
        },
        (e: unknown) => {
          if (e instanceof TripApiError && e.status === 404) setMissing(true);
          else setOffline(true);
        },
      ),
    [id],
  );

  useEffect(() => {
    refresh();
    if (locked) return;
    const timer = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh, locked]);

  async function act(work: () => Promise<Trip>) {
    setError(null);
    try {
      setTrip(await work());
    } catch (e) {
      if (e instanceof TripApiError && e.status === 403) clearIdentity(id);
      setError(e instanceof Error ? e.message : "Something went wrong.");
      refresh();
    }
  }

  async function join(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      const result = await tripApi<{ trip: Trip; memberId: string }>(`/${id}/join`, { name, avatar: { emoji: "🐙", color: "violet" } });
      setTrip(result.trip);
      if (!storeIdentity(id, { memberId: result.memberId })) setSessionIdentity({ memberId: result.memberId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join.");
    }
  }

  const vote = (stopKey: string, on: boolean) => memberId && act(() => tripApi<Trip>(`/${id}/vote`, { memberId, stopKey, on }));
  const suggest = (stop: StopInput) => {
    setPicking(false);
    if (memberId) act(() => tripApi<Trip>(`/${id}/candidates`, { memberId, stop }));
  };

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/trip/${id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy this page's address to invite friends.");
    }
  }

  if (missing) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">This trip has expired or the link is wrong.</p>
        <Link href="/plan" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
          Plan a day instead
        </Link>
      </main>
    );
  }
  if (!trip) return <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">Loading trip…</main>;

  const organizer = trip.members[trip.hostId]?.name ?? "the host";

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 lg:grid lg:grid-cols-2 lg:items-start">
      <header className="flex flex-col gap-2 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-4xl">{trip.title}</h1>
          <Button size="sm" variant="outline" className="rounded-full" onClick={copyInvite}>
            {copied ? "Link copied" : "Copy invite link"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(trip.members).map(([mid, n]) => (
            <span key={mid} className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs">
              {n.avatar.emoji} {n.name}
              {mid === trip.hostId && " · host"}
            </span>
          ))}
        </div>
        {offline && <p className="text-xs text-muted-foreground">Reconnecting…</p>}
        {sessionIdentity && <p className="text-xs text-muted-foreground">Your vote won&apos;t be remembered on this device.</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </header>

      <section className="flex flex-col gap-4">
        {!memberId && !locked && (
          <form onSubmit={join} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">{organizer} invited you to plan this day</p>
            <p className="text-xs text-muted-foreground">Add your name to suggest places and vote. No account needed.</p>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="Your name" required />
              <Button type="submit" disabled={!name.trim()}>
                Join
              </Button>
            </div>
          </form>
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Places</h2>
          <p className="mb-2 text-xs text-muted-foreground">Most votes go in the day. Up to 10 stops.</p>
          <CandidateList trip={trip} memberId={memberId} locked={locked} onVote={vote} />
          {memberId && !locked && !picking && (
            <Button variant="outline" className="mt-3 w-full" onClick={() => setPicking(true)} disabled={trip.candidates.length >= MAX_CANDIDATES}>
              Suggest a place
            </Button>
          )}
          {picking && (
            <div className="mt-3">
              <StopPicker
                stops={trip.candidates.map((c) => c.stop)}
                suggestions={[]}
                onAdd={suggest}
                onToggle={(a) => suggest(stopFromAttraction(a))}
                onInspect={() => {}}
                full={trip.candidates.length >= MAX_CANDIDATES}
              />
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        {locked && (
          <div className="rounded-xl border border-brand/35 bg-brand-soft p-4 text-sm">
            <p>
              <strong className="text-brand">Everyone&apos;s in.</strong> This is the final day.
            </p>
            <Link
              href={`/plan?plan=${trip.lockedCode}`}
              className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              Open in planner →
            </Link>
          </div>
        )}
        <DraftDay plan={draft.plan} updating={draft.updating} error={draft.error} locked={locked} />
        {memberId && !locked && (
          <Button className="w-full" disabled={!draft.plan} onClick={() => act(() => tripApi<Trip>(`/${id}/confirm`, { memberId, on: !mine }))}>
            {mine ? "I'm out" : "I'm in"} · {trip.consensus.confirmed.length} of {trip.consensus.total}
          </Button>
        )}
      </section>
    </main>
  );
}
