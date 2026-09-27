"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { StopInput } from "../bridge/index";
import { canShareNatively, copyText, shareNatively } from "../bridge/ui";
import type { Avatar } from "../core/avatars";
import type { Member, Trip } from "../core/types";
import { fetchTrip, tripApi, TripApiError, TripTimeoutError } from "./client";
import { clearIdentity, parseIdentity, readIdentityRaw, storeIdentity, subscribeIdentity, type TripIdentity } from "./local";
import { useDraftPlan } from "./useDraftPlan";

/** Every 3 s while the room is changing; every 10 s once it's been quiet for a minute. Never while hidden. */
const POLL_MS = 3000;
const IDLE_POLL_MS = 10_000;
const IDLE_AFTER_MS = 60_000;

export type RoomStatus = "loading" | "missing" | "ready";

/** The signed-in traveler, as this trip knows them (from the server; the same on every device). */
export interface Viewer {
  memberId: string;
  name: string;
}

/** Everything the trip room UI needs. Swap the components freely; keep this contract. */
export function useTripRoom(id: string, viewer: Viewer | null = null) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [status, setStatus] = useState<RoomStatus>("loading");
  const [offline, setOffline] = useState(false);
  const [slow, setSlow] = useState(false);
  const etag = useRef<string | null>(null);
  const changedAt = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionIdentity, setSessionIdentity] = useState<TripIdentity | null>(null);
  const [copied, setCopied] = useState(false);

  const raw = useSyncExternalStore(subscribeIdentity, () => readIdentityRaw(id), () => "");
  // An account is the same member everywhere; a guest is whoever this browser saved.
  const saved = viewer ? { memberId: viewer.memberId } : (parseIdentity(raw) ?? sessionIdentity);
  const memberId = saved && trip && saved.memberId in trip.members ? saved.memberId : null;
  const me: (Member & { id: string }) | null = memberId && trip ? { id: memberId, ...trip.members[memberId] } : null;
  const locked = !!trip?.lockedCode;
  const draft = useDraftPlan(trip);

  const refresh = useCallback(
    () =>
      fetchTrip<Trip>(id, etag.current).then(
        (next) => {
          if (next.trip) {
            etag.current = next.etag;
            changedAt.current = Date.now();
            setTrip(next.trip);
          }
          setStatus("ready");
          setOffline(false);
          setSlow(false);
        },
        (e: unknown) => {
          if (e instanceof TripApiError && e.status === 404) setStatus("missing");
          else if (e instanceof TripTimeoutError) setSlow(true);
          else setOffline(true);
        },
      ),
    [id],
  );

  useEffect(() => {
    // Sign-in is checked on the server before this page renders (app/trip/[id]/page.tsx).
    let timer: number | undefined;
    let stopped = false;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      await refresh();
      inFlight = false;
      if (stopped || locked || document.hidden) return;
      timer = window.setTimeout(tick, Date.now() - changedAt.current > IDLE_AFTER_MS ? IDLE_POLL_MS : POLL_MS);
    };
    // A hidden tab stops asking; coming back catches up at once.
    const onVisible = () => {
      window.clearTimeout(timer);
      if (!document.hidden && !locked) void tick();
    };
    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, refresh, locked]);

  async function act(work: () => Promise<Trip>) {
    setError(null);
    setBusy(true);
    try {
      setTrip(await work());
    } catch (e) {
      if (e instanceof TripApiError && e.status === 403) clearIdentity(id);
      setError(e instanceof Error ? e.message : "Something went wrong.");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  const actions = {
    async join(name: string, avatar: Avatar) {
      setError(null);
      try {
        const result = await tripApi<{ trip: Trip; memberId: string }>(`/${id}/join`, { name, avatar });
        setTrip(result.trip);
        if (!viewer && !storeIdentity(id, { memberId: result.memberId })) setSessionIdentity({ memberId: result.memberId });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't join.");
      }
    },
    /** A trip the server already changed (the host's Ask planned the day). */
    adopt: (next: Trip) => setTrip(next),
    suggest: (stop: StopInput, note?: string | null) => memberId && act(() => tripApi<Trip>(`/${id}/candidates`, { memberId, stop, note: note || null })),
    remove: (stopKey: string) => memberId && act(() => tripApi<Trip>(`/${id}/remove`, { memberId, stopKey })),
    vote: (stopKey: string, on: boolean) => memberId && act(() => tripApi<Trip>(`/${id}/vote`, { memberId, stopKey, on })),
    setStart: (point: { lat: number; lon: number } | null) => memberId && act(() => tripApi<Trip>(`/${id}/start`, { memberId, point })),
    postIdea: (text: string) => memberId && act(() => tripApi<Trip>(`/${id}/ideas`, { memberId, text })),
    voteIdea: (ideaId: string, on: boolean) => memberId && act(() => tripApi<Trip>(`/${id}/ideas/vote`, { memberId, ideaId, on })),
    async ideaToPlace(ideaId: string, stop: StopInput, authorId: string) {
      if (!memberId) return;
      await act(() => tripApi<Trip>(`/${id}/candidates`, { memberId, stop, creditTo: authorId }));
      await act(() => tripApi<Trip>(`/${id}/ideas/link`, { memberId, ideaId, placeKey: stop.key }));
    },
    setFree: (free: { from: number; to: number } | null) => memberId && act(() => tripApi<Trip>(`/${id}/free`, { memberId, free })),
    saveItinerary: (order: string[]) => memberId && act(() => tripApi<Trip>(`/${id}/itinerary`, { memberId, order })),
    regenerate: () => memberId && act(() => tripApi<Trip>(`/${id}/itinerary/regenerate`, { memberId })),
    confirm: (on: boolean) => memberId && act(() => tripApi<Trip>(`/${id}/confirm`, { memberId, on })),
    /** The host's final say: locks the day and texts it to everyone. */
    approve: () => memberId && act(() => tripApi<Trip>(`/${id}/approve`, { memberId })),
    /** Phones get their share sheet (Messages, WhatsApp…); elsewhere the link is copied. Call it straight from the tap. */
    async copyInvite() {
      const url = `${window.location.origin}/trip/${id}`;
      if (canShareNatively()) {
        const shared = await shareNatively(trip?.title ? `Plan ${trip.title} with me` : "Plan a NYC day with me", url);
        if (shared !== "failed") return;
      }
      if (await copyText(url)) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } else {
        setError("Copy this page's address to invite friends.");
      }
    },
  };

  return { trip, me, draft, status, offline, slow, error, busy, copied, locked, viewer, rememberWarning: !viewer && !!sessionIdentity, actions };
}

export type TripRoomState = ReturnType<typeof useTripRoom>;
