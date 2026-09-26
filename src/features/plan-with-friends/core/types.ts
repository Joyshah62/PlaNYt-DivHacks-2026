import type { PlanRequest, StopInput } from "../bridge/index";

export const MAX_DAY_STOPS = 10;
export const MAX_CANDIDATES = 30;

export type TripSettings = Omit<PlanRequest, "stops" | "keepOrder">;

export interface Candidate {
  stop: StopInput;
  addedBy: string;
  addedAt: number;
  votes: string[];
}

export interface Trip {
  id: string;
  title: string;
  createdAt: number;
  organizerId: string;
  settings: TripSettings;
  members: Record<string, string>;
  candidates: Candidate[];
  lockedCode: string | null;
}
