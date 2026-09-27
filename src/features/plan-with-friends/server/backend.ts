import type { StopInput } from "../bridge/index";
import type { StoredItinerary } from "../core/itinerary";
import type { Idea, Member, TripSettings } from "../core/types";

export const TRIP_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface TripMeta {
  id: string;
  title: string;
  createdAt: number;
  hostId: string;
  settings: TripSettings;
  deadline: number | null;
  lockedCode: string | null;
  /** Set once someone arranges the day by hand. */
  itinerary?: StoredItinerary | null;
}

export interface CandidateRecord {
  stop: StopInput;
  addedBy: string;
  addedAt: number;
  note?: string | null;
}

/** Trips saved before v2 kept members as plain names and an organizer id; the service upgrades them on read. */
export type StoredMember = Member | string;
export type StoredMeta = Omit<TripMeta, "hostId" | "deadline"> & { hostId?: string; organizerId?: string; deadline?: number | null };

/** Each call is atomic on its own; the rules that combine them live in service.ts. */
export interface TripBackend {
  getMeta(id: string): Promise<StoredMeta | null>;
  setMeta(meta: TripMeta): Promise<void>;
  setDeadline(id: string, deadline: number | null): Promise<void>;
  setItinerary(id: string, itinerary: StoredItinerary | null): Promise<void>;
  /** Sets lockedCode only if the trip isn't locked yet; false when someone else locked it first. */
  lock(id: string, code: string): Promise<boolean>;
  getMembers(id: string): Promise<Record<string, StoredMember>>;
  setMember(id: string, memberId: string, member: Member): Promise<void>;
  getConfirmations(id: string): Promise<Record<string, string>>;
  setConfirmation(id: string, memberId: string, signature: string | null): Promise<void>;
  getCandidates(id: string): Promise<Record<string, CandidateRecord>>;
  /** False when that stop key is already a candidate. */
  addCandidate(id: string, record: CandidateRecord): Promise<boolean>;
  removeCandidate(id: string, stopKey: string): Promise<void>;
  getVotes(id: string, stopKeys: string[]): Promise<Record<string, string[]>>;
  setVote(id: string, stopKey: string, memberId: string, on: boolean): Promise<void>;
  touch(id: string, stopKeys: string[]): Promise<void>;
  /** Newest `limit` ideas, oldest first; plus how many exist in total. */
  listIdeas(id: string, limit: number): Promise<{ ideas: Idea[]; total: number }>;
  addIdea(id: string, idea: Idea): Promise<void>;
  setIdeaVote(id: string, ideaId: string, memberId: string, on: boolean): Promise<boolean>;
  linkIdea(id: string, ideaId: string, placeKey: string): Promise<boolean>;
  /** The trips a member is in, newest first, with how many people are in each. */
  tripsFor(memberId: string, limit: number): Promise<{ meta: StoredMeta; memberCount: number }[]>;
}
