import type { Collection, Db } from "mongodb";
import { TRIP_TTL_SECONDS, type CandidateRecord, type TripBackend, type TripMeta } from "./backend";

export interface TripDoc {
  _id: string;
  meta: TripMeta;
  members: Record<string, string>;
  candidates: (CandidateRecord & { votes: string[] })[];
  expiresAt: Date;
}

const expiry = () => new Date(Date.now() + TRIP_TTL_SECONDS * 1000);

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
  const load = async (id: string) => (await trips()).findOne({ _id: id });

  return {
    async getMeta(id) {
      return (await load(id))?.meta ?? null;
    },
    async setMeta(meta) {
      await (await trips()).updateOne(
        { _id: meta.id },
        { $set: { meta, expiresAt: expiry() }, $setOnInsert: { members: {}, candidates: [] } },
        { upsert: true },
      );
    },
    async getMembers(id) {
      return (await load(id))?.members ?? {};
    },
    async setMember(id, memberId, name) {
      await (await trips()).updateOne({ _id: id }, { $set: { [`members.${memberId}`]: name, expiresAt: expiry() } });
    },
    async getCandidates(id) {
      const doc = await load(id);
      return Object.fromEntries((doc?.candidates ?? []).map(({ stop, addedBy, addedAt }) => [stop.key, { stop, addedBy, addedAt }]));
    },
    async addCandidate(id, record) {
      const result = await (await trips()).updateOne(
        { _id: id, "candidates.stop.key": { $ne: record.stop.key } },
        { $push: { candidates: { ...record, votes: [] } }, $set: { expiresAt: expiry() } },
      );
      return result.modifiedCount === 1;
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
  };
}
