"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { StopInput } from "../bridge/index";
import type { Avatar } from "../core/avatars";
import type { Member, Trip } from "../core/types";
import { identity } from "../identity";
import { tripApi, TripApiError } from "./client";
import { clearIdentity, parseIdentity, readIdentityRaw, storeIdentity, subscribeIdentity, type TripIdentity } from "./local";
import { useDraftPlan } from "./useDraftPlan";

const POLL_MS = 3000;

export type RoomStatus = "loading" | "missing" | "ready";

/** Everything the trip room UI needs. Swap the components freely; keep this contract. */
export function useTripRoom(id: string) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [status, setStatus] = useState<RoomStatus>("loading");
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionIdentity, setSessionIdentity] = useState<TripIdentity | null>(null);
  const [copied, setCopied] = useState(false);

  const raw = useSyncExternalStore(subscribeIdentity, () => readIdentityRaw(id), () => "");
  const saved = parseIdentity(raw) ?? sessionIdentity;
  const memberId = saved && trip && saved.memberId in trip.members ? saved.memberId : null;
  const me: (Member & { id: string }) | null = memberId && trip ? { id: memberId, ...trip.members[memberId] } : null;
  const locked = !!trip?.lockedCode;
  const draft = useDraftPlan(trip);

  const refresh = useCallback(
    () =>
      tripApi<Trip>(`/${id}`).then(
        (next) => {
          setTrip(next);
          setStatus("ready");
          setOffline(false);
        },
        (e: unknown) => {
          if (e instanceof TripApiError && e.status === 404) setStatus("missing");
          else setOffline(true);
        },
      ),
    [id],
  );

  useEffect(() => {
    const login = identity.loginUrl(`/trip/${id}`);
    if (login && !readIdentityRaw(id)) {
      window.location.assign(login);
      return;
    }
    refresh();
    if (locked) return;
    const timer = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(timer);
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
        if (!storeIdentity(id, { memberId: result.memberId })) setSessionIdentity({ memberId: result.memberId });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't join.");
      }
    },
    suggest: (stop: StopInput) => memberId && act(() => tripApi<Trip>(`/${id}/candidates`, { memberId, stop })),
    remove: (stopKey: string) => memberId && act(() => tripApi<Trip>(`/${id}/remove`, { memberId, stopKey })),
    vote: (stopKey: string, on: boolean) => memberId && act(() => tripApi<Trip>(`/${id}/vote`, { memberId, stopKey, on })),
    setStart: (point: { lat: number; lon: number } | null) => memberId && act(() => tripApi<Trip>(`/${id}/start`, { memberId, point })),
    confirm: (on: boolean) => memberId && act(() => tripApi<Trip>(`/${id}/confirm`, { memberId, on })),
    setDeadline: (at: number | null) => memberId && act(() => tripApi<Trip>(`/${id}/deadline`, { memberId, at })),
    async copyInvite() {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/trip/${id}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Copy this page's address to invite friends.");
      }
    },
  };

  return { trip, me, draft, status, offline, error, busy, copied, locked, rememberWarning: !!sessionIdentity, actions };
}

export type TripRoomState = ReturnType<typeof useTripRoom>;
