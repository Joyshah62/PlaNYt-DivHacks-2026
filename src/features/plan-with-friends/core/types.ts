import type { PlanRequest, StopInput } from "../bridge/index";
import type { Avatar } from "./avatars";
import type { Consensus } from "./consensus";

export const MAX_DAY_STOPS = 10;
export const MAX_CANDIDATES = 30;
export const MAX_MEMBERS = 12;

export type TripSettings = Omit<PlanRequest, "stops" | "keepOrder">;

export interface Member {
  name: string;
  avatar: Avatar;
  joinedAt: number;
}

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
  hostId: string;
  settings: TripSettings;
  members: Record<string, Member>;
  candidates: Candidate[];
  deadline: number | null;
  confirmations: Record<string, string>;
  consensus: Consensus;
  lockedCode: string | null;
}
