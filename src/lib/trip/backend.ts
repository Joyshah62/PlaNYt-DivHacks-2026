import type { StopInput } from "@/lib/plan/types";
import type { TripSettings } from "./types";

export const TRIP_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface TripMeta {
  id: string;
  title: string;
  createdAt: number;
  organizerId: string;
  organizerKeyHash: string;
  settings: TripSettings;
  lockedCode: string | null;
}

export interface CandidateRecord {
  stop: StopInput;
  addedBy: string;
  addedAt: number;
}

/** Each call is atomic on its own; the rules that combine them live in service.ts. */
export interface TripBackend {
  getMeta(id: string): Promise<TripMeta | null>;
  setMeta(meta: TripMeta): Promise<void>;
  getMembers(id: string): Promise<Record<string, string>>;
  setMember(id: string, memberId: string, name: string): Promise<void>;
  getCandidates(id: string): Promise<Record<string, CandidateRecord>>;
  /** False when that stop key is already a candidate. */
  addCandidate(id: string, record: CandidateRecord): Promise<boolean>;
  getVotes(id: string, stopKeys: string[]): Promise<Record<string, string[]>>;
  setVote(id: string, stopKey: string, memberId: string, on: boolean): Promise<void>;
  touch(id: string, stopKeys: string[]): Promise<void>;
}
