"use client";

import { useEffect, useState } from "react";
import { APP_API, type DayPlan } from "../bridge/index";
import type { Trip } from "../core/types";

export function useDraftPlan(trip: Trip | null) {
  // Polling hands back a new Trip every 4 s; only a change in the request itself re-plans.
  const signature = trip?.draft ? JSON.stringify(trip.draft) : "";
  const [state, setState] = useState<{ signature: string; plan: DayPlan | null; error: string | null }>({ signature: "", plan: null, error: null });

  useEffect(() => {
    if (!signature) return;
    const controller = new AbortController();
    fetch(APP_API.plan, { method: "POST", headers: { "content-type": "application/json" }, body: signature, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("plan failed");
        return (await res.json()) as DayPlan;
      })
      .then((plan) => setState({ signature, plan, error: null }))
      .catch(() => {
        if (!controller.signal.aborted) setState((s) => ({ ...s, signature, error: "Couldn't update the draft day." }));
      });
    return () => controller.abort();
  }, [signature]);

  return {
    plan: signature ? state.plan : null,
    updating: signature !== "" && signature !== state.signature,
    error: signature ? state.error : null,
  };
}
