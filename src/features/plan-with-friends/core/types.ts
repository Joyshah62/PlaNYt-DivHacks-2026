import type { PlanRequest, StopInput } from "../bridge/index";
import type { FreeWindow, GroupWindow } from "./availability";
import type { Avatar } from "./avatars";
import type { Consensus } from "./consensus";
import type { FairPick } from "./fairness";
import type { ItineraryState } from "./itinerary";

export const MAX_DAY_STOPS = 10;
export const MAX_CANDIDATES = 30;
export const MAX_MEMBERS = 12;
export const MAX_IDEAS = 300;
export const IDEAS_SHOWN = 100;

export type TripSettings = Omit<PlanRequest, "stops" | "keepOrder">;

export interface StartPoint {
  /** What others see, e.g. "near Astor Pl". */
  area: string;
  lat: number;
  lon: number;
}

export interface Member {
  name: string;
  avatar: Avatar;
  joinedAt: number;
  start?: StartPoint | null;
  free?: FreeWindow | null;
}

export interface Fairness {
  /** Members who shared where they start. */
  starts: number;
  firstStop: FairPick | null;
  meetup: FairPick | null;
}

export interface Idea {
  id: string;
  memberId: string;
  text: string;
  votes: string[];
  /** The place this idea turned into, once someone found one. */
  placeKey: string | null;
  at: number;
}

export interface Candidate {
  stop: StopInput;
  addedBy: string;
  addedAt: number;
  votes: string[];
  /** The suggester's optional "why". */
  note?: string | null;
}

export interface Trip {
  id: string;
  title: string;
  createdAt: number;
  hostId: string;
  settings: TripSettings;
  members: Record<string, Member>;
  candidates: Candidate[];
  /** Oldest first, the latest IDEAS_SHOWN. */
  ideas: Idea[];
  deadline: number | null;
  confirmations: Record<string, string>;
  consensus: Consensus;
  /** The day the group is deciding on, including where it starts. */
  draft: PlanRequest | null;
  fairness: Fairness | null;
  /** When the group can meet, from everyone's free time. */
  window: GroupWindow | null;
  itinerary: ItineraryState;
  lockedCode: string | null;
}
