import type { CandidateRecord, TripBackend, TripMeta } from "./backend";

export interface MemoryEntry {
  meta: TripMeta;
  members: Map<string, string>;
  cands: Map<string, CandidateRecord>;
  votes: Map<string, Set<string>>;
}

function shared(): Map<string, MemoryEntry> {
  // globalThis survives dev hot reloads; a server restart still clears it.
  const g = globalThis as typeof globalThis & { __roamTrips?: Map<string, MemoryEntry> };
  return (g.__roamTrips ??= new Map());
}

export function memoryBackend(trips: Map<string, MemoryEntry> = shared()): TripBackend {
  return {
    async getMeta(id) {
      const meta = trips.get(id)?.meta;
      return meta ? structuredClone(meta) : null;
    },
    async setMeta(meta) {
      const entry = trips.get(meta.id);
      if (entry) entry.meta = structuredClone(meta);
      else trips.set(meta.id, { meta: structuredClone(meta), members: new Map(), cands: new Map(), votes: new Map() });
    },
    async getMembers(id) {
      return Object.fromEntries(trips.get(id)?.members ?? []);
    },
    async setMember(id, memberId, name) {
      trips.get(id)?.members.set(memberId, name);
    },
    async getCandidates(id) {
      return structuredClone(Object.fromEntries(trips.get(id)?.cands ?? []));
    },
    async addCandidate(id, record) {
      const entry = trips.get(id);
      if (!entry || entry.cands.has(record.stop.key)) return false;
      entry.cands.set(record.stop.key, structuredClone(record));
      return true;
    },
    async getVotes(id, stopKeys) {
      const entry = trips.get(id);
      return Object.fromEntries(stopKeys.map((key) => [key, [...(entry?.votes.get(key) ?? [])]]));
    },
    async setVote(id, stopKey, memberId, on) {
      const entry = trips.get(id);
      if (!entry) return;
      const set = entry.votes.get(stopKey) ?? new Set<string>();
      if (on) set.add(memberId);
      else set.delete(memberId);
      entry.votes.set(stopKey, set);
    },
    async touch() {},
  };
}
