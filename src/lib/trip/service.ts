import { createHash, randomBytes } from "node:crypto";
import { encodePlan } from "@/lib/plan/share";
import type { StopInput } from "@/lib/plan/types";
import type { TripBackend, TripMeta } from "./backend";
import { draftRequest } from "./rank";
import { MAX_CANDIDATES, type Trip, type TripSettings } from "./types";

export class TripError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const LOCKED = "This plan is locked.";
const newId = (bytes: number) => randomBytes(bytes).toString("base64url");
const hash = (key: string) => createHash("sha256").update(key).digest("hex");

export interface CreateTripInput {
  title: string;
  settings: TripSettings;
  stops: StopInput[];
  name: string;
}

export function createTripService(db: TripBackend, now: () => number = Date.now) {
  async function read(id: string): Promise<{ meta: TripMeta; trip: Trip }> {
    const meta = await db.getMeta(id);
    if (!meta) throw new TripError(404, "This trip has expired or the link is wrong.");
    const [members, records] = await Promise.all([db.getMembers(id), db.getCandidates(id)]);
    const votes = await db.getVotes(id, Object.keys(records));
    const candidates = Object.values(records)
      .sort((a, b) => a.addedAt - b.addedAt)
      .map((r) => ({ ...r, votes: votes[r.stop.key] ?? [] }));
    const trip: Trip = {
      id: meta.id,
      title: meta.title,
      createdAt: meta.createdAt,
      organizerId: meta.organizerId,
      settings: meta.settings,
      lockedCode: meta.lockedCode,
      members,
      candidates,
    };
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
      const memberId = newId(9);
      const organizerKey = newId(24);
      const at = now();
      await db.setMeta({ id, title: input.title, createdAt: at, organizerId: memberId, organizerKeyHash: hash(organizerKey), settings: input.settings, lockedCode: null });
      await db.setMember(id, memberId, input.name);
      for (const [i, stop] of input.stops.entries()) {
        if (await db.addCandidate(id, { stop, addedBy: memberId, addedAt: at + i })) await db.setVote(id, stop.key, memberId, true);
      }
      return { trip: await saved(id), memberId, organizerKey };
    },

    async get(id: string) {
      return (await read(id)).trip;
    },

    async join(id: string, name: string) {
      const { trip } = await read(id);
      if (trip.lockedCode) throw new TripError(409, LOCKED);
      const memberId = newId(9);
      await db.setMember(id, memberId, name);
      return { trip: await saved(id), memberId };
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

    async lock(id: string, organizerKey: string) {
      const { meta, trip } = await read(id);
      if (hash(organizerKey) !== meta.organizerKeyHash) throw new TripError(403, "Only the organizer can lock the plan.");
      if (trip.lockedCode) return trip;
      const request = draftRequest(trip);
      if (!request) throw new TripError(400, "Vote for at least one place first.");
      await db.setMeta({ ...meta, lockedCode: encodePlan(request) });
      return saved(id);
    },
  };
}

export type TripService = ReturnType<typeof createTripService>;
