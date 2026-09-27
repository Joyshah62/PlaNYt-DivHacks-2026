import type { Collection, Db, PullOperator } from "mongodb";
import type { Idea, Member } from "../core/types";
import { TRIP_TTL_SECONDS, type CandidateRecord, type StoredMember, type StoredMeta, type TripBackend } from "./backend";

export interface TripDoc {
  _id: string;
  meta: StoredMeta;
  members: Record<string, StoredMember>;
  confirmations?: Record<string, string>;
  candidates: (CandidateRecord & { votes: string[] })[];
  expiresAt: Date;
}

const expiry = () => new Date(Date.now() + TRIP_TTL_SECONDS * 1000);

type IdeaDoc = Idea & { _id: string; tripId: string; expiresAt: Date };

export function mongoBackend(db: () => Promise<Db>): TripBackend {
  let ready: Promise<Collection<TripDoc>> | null = null;
  const trips = () =>
    (ready ??= db()
      .then(async (d) => {
        const col = d.collection<TripDoc>("trips");
        await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        return col;
      })
      .catch((error: unknown) => {
        ready = null;
        throw error;
      }));
  let ideasReady: Promise<Collection<IdeaDoc>> | null = null;
  const ideas = () =>
    (ideasReady ??= db()
      .then(async (d) => {
        const col = d.collection<IdeaDoc>("trip_ideas");
        await col.createIndex({ tripId: 1, at: -1 });
        await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        return col;
      })
      .catch((error: unknown) => {
        ideasReady = null;
        throw error;
      }));
  const load = async (id: string) => (await trips()).findOne({ _id: id });

  return {
    async getMeta(id) {
      return (await load(id))?.meta ?? null;
    },
    async setMeta(meta) {
      await (await trips()).updateOne(
        { _id: meta.id },
        { $set: { meta, expiresAt: expiry() }, $setOnInsert: { members: {}, confirmations: {}, candidates: [] } },
        { upsert: true },
      );
    },
    async setDeadline(id, deadline) {
      await (await trips()).updateOne({ _id: id }, { $set: { "meta.deadline": deadline, expiresAt: expiry() } });
    },
    async lock(id, code) {
      const result = await (await trips()).updateOne({ _id: id, "meta.lockedCode": null }, { $set: { "meta.lockedCode": code, expiresAt: expiry() } });
      return result.modifiedCount === 1;
    },
    async getMembers(id) {
      return (await load(id))?.members ?? {};
    },
    async setMember(id, memberId, member: Member) {
      await (await trips()).updateOne({ _id: id }, { $set: { [`members.${memberId}`]: member, expiresAt: expiry() } });
    },
    async getConfirmations(id) {
      return (await load(id))?.confirmations ?? {};
    },
    async setConfirmation(id, memberId, signature) {
      const field = `confirmations.${memberId}`;
      await (await trips()).updateOne({ _id: id }, signature ? { $set: { [field]: signature } } : { $unset: { [field]: "" } });
    },
    async getCandidates(id) {
      const doc = await load(id);
      return Object.fromEntries((doc?.candidates ?? []).map(({ stop, addedBy, addedAt, note }) => [stop.key, { stop, addedBy, addedAt, note: note ?? null }]));
    },
    async addCandidate(id, record) {
      const result = await (await trips()).updateOne(
        { _id: id, "candidates.stop.key": { $ne: record.stop.key } },
        { $push: { candidates: { ...record, votes: [] } }, $set: { expiresAt: expiry() } },
      );
      return result.modifiedCount === 1;
    },
    async removeCandidate(id, stopKey) {
      // The driver's types don't model a dotted path inside a $pull condition; MongoDB accepts it.
      await (await trips()).updateOne({ _id: id }, { $pull: { candidates: { "stop.key": stopKey } } as unknown as PullOperator<TripDoc>, $set: { expiresAt: expiry() } });
    },
    async getVotes(id, stopKeys) {
      const doc = await load(id);
      const byKey = new Map((doc?.candidates ?? []).map((c) => [c.stop.key, c.votes]));
      return Object.fromEntries(stopKeys.map((key) => [key, byKey.get(key) ?? []]));
    },
    async setVote(id, stopKey, memberId, on) {
      const filter = { _id: id, "candidates.stop.key": stopKey };
      await (await trips()).updateOne(
        filter,
        on ? { $addToSet: { "candidates.$.votes": memberId } } : { $pull: { "candidates.$.votes": memberId } },
      );
    },
    async touch(id) {
      await (await trips()).updateOne({ _id: id }, { $set: { expiresAt: expiry() } });
    },
    async listIdeas(id, limit) {
      const col = await ideas();
      const [docs, total] = await Promise.all([col.find({ tripId: id }).sort({ at: -1 }).limit(limit).toArray(), col.countDocuments({ tripId: id })]);
      return { ideas: docs.reverse().map(({ id: ideaId, memberId, text, votes, placeKey, at }) => ({ id: ideaId, memberId, text, votes, placeKey, at })), total };
    },
    async addIdea(id, idea) {
      await (await ideas()).insertOne({ ...idea, _id: `${id}:${idea.id}`, tripId: id, expiresAt: expiry() });
    },
    async setIdeaVote(id, ideaId, memberId, on) {
      const r = await (await ideas()).updateOne({ _id: `${id}:${ideaId}` }, on ? { $addToSet: { votes: memberId } } : { $pull: { votes: memberId } });
      return r.matchedCount === 1;
    },
    async linkIdea(id, ideaId, placeKey) {
      const r = await (await ideas()).updateOne({ _id: `${id}:${ideaId}` }, { $set: { placeKey } });
      return r.matchedCount === 1;
    },
  };
}
