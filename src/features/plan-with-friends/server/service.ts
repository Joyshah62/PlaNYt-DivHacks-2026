import { randomBytes } from "node:crypto";
import { encodePlan, type StopInput } from "../bridge/index";
import { defaultAvatar, type Avatar } from "../core/avatars";
import { consensus } from "../core/consensus";
import { draftRequest } from "../core/rank";
import { MAX_CANDIDATES, MAX_MEMBERS, type Member, type Trip, type TripSettings } from "../core/types";
import type { StoredMember, StoredMeta, TripBackend, TripMeta } from "./backend";

export class TripError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const LOCKED = "This plan is locked.";
const MAX_DEADLINE_MS = 14 * 24 * 60 * 60 * 1000;
const newId = (bytes: number) => randomBytes(bytes).toString("base64url");

export interface CreateTripInput {
  title: string;
  settings: TripSettings;
  stops: StopInput[];
  name: string;
  avatar: Avatar;
  /** A signed-in user's stable id; guests get a random one. */
  memberId?: string;
}

function upgradeMeta(stored: StoredMeta): TripMeta {
  return {
    id: stored.id,
    title: stored.title,
    createdAt: stored.createdAt,
    hostId: stored.hostId ?? stored.organizerId ?? "",
    settings: stored.settings,
    deadline: stored.deadline ?? null,
    lockedCode: stored.lockedCode,
  };
}

function upgradeMember(memberId: string, stored: StoredMember): Member {
  return typeof stored === "string" ? { name: stored, avatar: defaultAvatar(memberId), joinedAt: 0 } : stored;
}

export function createTripService(db: TripBackend, now: () => number = Date.now) {
  async function read(id: string): Promise<{ meta: TripMeta; trip: Trip }> {
    const stored = await db.getMeta(id);
    if (!stored) throw new TripError(404, "This trip has expired or the link is wrong.");
    const meta = upgradeMeta(stored);
    const [rawMembers, records, confirmations] = await Promise.all([db.getMembers(id), db.getCandidates(id), db.getConfirmations(id)]);
    const votes = await db.getVotes(id, Object.keys(records));
    const members = Object.fromEntries(Object.entries(rawMembers).map(([mid, m]) => [mid, upgradeMember(mid, m)]));
    const candidates = Object.values(records)
      .sort((a, b) => a.addedAt - b.addedAt)
      .map((r) => ({ ...r, votes: votes[r.stop.key] ?? [] }));
    const partial = { id: meta.id, title: meta.title, createdAt: meta.createdAt, hostId: meta.hostId, settings: meta.settings, members, candidates };
    const draft = draftRequest(partial);
    const memberIds = Object.keys(members).sort((a, b) => members[a].joinedAt - members[b].joinedAt);
    const c = consensus({ members: memberIds, confirmations, draft, deadline: meta.deadline, now: now() });
    let lockedCode = meta.lockedCode;
    // Group agreement locks the plan the first time anyone looks after it's reached.
    if (!lockedCode && c.shouldLock && draft) {
      const code = encodePlan(draft);
      lockedCode = (await db.lock(id, code)) ? code : ((await db.getMeta(id))?.lockedCode ?? code);
    }
    const trip: Trip = { ...partial, deadline: meta.deadline, confirmations, consensus: c, lockedCode };
    return { meta, trip };
  }

  async function editable(id: string, memberId: string) {
    const result = await read(id);
    if (result.trip.lockedCode) throw new TripError(409, LOCKED);
    if (!(memberId in result.trip.members)) throw new TripError(403, "Join the trip first.");
    return result;
  }

  async function saved(id: string): Promise<Trip> {
    const { trip } = await read(id);
    await db.touch(id, trip.candidates.map((c) => c.stop.key));
    return trip;
  }

  return {
    async create(input: CreateTripInput) {
      const id = newId(8).slice(0, 10);
      const memberId = input.memberId ?? newId(9);
      const at = now();
      await db.setMeta({ id, title: input.title, createdAt: at, hostId: memberId, settings: input.settings, deadline: null, lockedCode: null });
      await db.setMember(id, memberId, { name: input.name, avatar: input.avatar, joinedAt: at });
      for (const [i, stop] of input.stops.entries()) {
        if (await db.addCandidate(id, { stop, addedBy: memberId, addedAt: at + i })) await db.setVote(id, stop.key, memberId, true);
      }
      return { trip: await saved(id), memberId };
    },

    async get(id: string) {
      return (await read(id)).trip;
    },

    async join(id: string, name: string, avatar: Avatar, memberId?: string) {
      const { trip } = await read(id);
      if (trip.lockedCode) throw new TripError(409, LOCKED);
      const mid = memberId ?? newId(9);
      if (!(mid in trip.members) && Object.keys(trip.members).length >= MAX_MEMBERS) throw new TripError(400, `This trip is full (${MAX_MEMBERS} people).`);
      await db.setMember(id, mid, { name, avatar, joinedAt: trip.members[mid]?.joinedAt ?? now() });
      return { trip: await saved(id), memberId: mid };
    },

    async addCandidate(id: string, memberId: string, stop: StopInput) {
      const { trip } = await editable(id, memberId);
      if (!trip.candidates.some((c) => c.stop.key === stop.key)) {
        if (trip.candidates.length >= MAX_CANDIDATES) throw new TripError(400, "This trip has enough ideas. Vote on the ones already here.");
        await db.addCandidate(id, { stop, addedBy: memberId, addedAt: now() });
      }
      await db.setVote(id, stop.key, memberId, true);
      return saved(id);
    },

    async vote(id: string, memberId: string, stopKey: string, on: boolean) {
      const { trip } = await editable(id, memberId);
      if (!trip.candidates.some((c) => c.stop.key === stopKey)) throw new TripError(404, "That place isn't on this trip.");
      await db.setVote(id, stopKey, memberId, on);
      return saved(id);
    },

    async confirm(id: string, memberId: string, on: boolean) {
      const { trip } = await editable(id, memberId);
      if (on && !trip.consensus.signature) throw new TripError(400, "Vote for a place first.");
      await db.setConfirmation(id, memberId, on ? trip.consensus.signature : null);
      return saved(id);
    },

    async setDeadline(id: string, memberId: string, at: number | null) {
      await editable(id, memberId);
      if (at !== null && (at <= now() || at > now() + MAX_DEADLINE_MS)) throw new TripError(400, "Pick a deadline in the next two weeks.");
      await db.setDeadline(id, at);
      return saved(id);
    },
  };
}

export type TripService = ReturnType<typeof createTripService>;
