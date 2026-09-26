import type { PlanRequest } from "../bridge/index";
import { MAX_DAY_STOPS, type Candidate, type Trip } from "./types";

export function rankCandidates(trip: Trip): { inDay: Candidate[]; waiting: Candidate[] } {
  const sorted = [...trip.candidates].sort((a, b) => b.votes.length - a.votes.length || a.addedAt - b.addedAt);
  const inDay = sorted.filter((c) => c.votes.length > 0).slice(0, MAX_DAY_STOPS);
  const picked = new Set(inDay);
  return { inDay, waiting: sorted.filter((c) => !picked.has(c)) };
}

export function draftRequest(trip: Trip): PlanRequest | null {
  const stops = rankCandidates(trip).inDay.map((c) => c.stop);
  return stops.length ? { ...trip.settings, stops } : null;
}
