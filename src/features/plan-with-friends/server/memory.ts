import type { Idea, Member } from "../core/types";
import type { CandidateRecord, TripBackend, TripMeta } from "./backend";

export interface MemoryEntry {
  meta: TripMeta;
  members: Map<string, Member>;
  confirmations: Map<string, string>;
  cands: Map<string, CandidateRecord>;
  votes: Map<string, Set<string>>;
  ideas: Idea[];
}

function shared(): Map<string, MemoryEntry> {
  // globalThis survives dev hot reloads; a server restart still clears it.
  const g = globalThis as typeof globalThis & { __roamTripsV2?: Map<string, MemoryEntry> };
  return (g.__roamTripsV2 ??= new Map());
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
      else trips.set(meta.id, { meta: structuredClone(meta), members: new Map(), confirmations: new Map(), cands: new Map(), votes: new Map(), ideas: [] });
    },
    async setItinerary(id, itinerary) {
      const entry = trips.get(id);
      if (entry) entry.meta.itinerary = structuredClone(itinerary);
    },
    async lock(id, code) {
      const entry = trips.get(id);
      if (!entry || entry.meta.lockedCode) return false;
      entry.meta.lockedCode = code;
      return true;
    },
    async getMembers(id) {
      return structuredClone(Object.fromEntries(trips.get(id)?.members ?? []));
    },
    async setMember(id, memberId, member) {
      trips.get(id)?.members.set(memberId, structuredClone(member));
    },
    async getConfirmations(id) {
      return Object.fromEntries(trips.get(id)?.confirmations ?? []);
    },
    async setConfirmation(id, memberId, signature) {
      const entry = trips.get(id);
      if (!entry) return;
      if (signature) entry.confirmations.set(memberId, signature);
      else entry.confirmations.delete(memberId);
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
    async removeCandidate(id, stopKey) {
      const entry = trips.get(id);
      entry?.cands.delete(stopKey);
      entry?.votes.delete(stopKey);
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
    async listIdeas(id, limit) {
      const ideas = trips.get(id)?.ideas ?? [];
      return { ideas: structuredClone(ideas.slice(-limit)), total: ideas.length };
    },
    async addIdea(id, idea) {
      trips.get(id)?.ideas.push(structuredClone(idea));
    },
    async setIdeaVote(id, ideaId, memberId, on) {
      const idea = trips.get(id)?.ideas.find((i) => i.id === ideaId);
      if (!idea) return false;
      idea.votes = on ? [...new Set([...idea.votes, memberId])] : idea.votes.filter((v) => v !== memberId);
      return true;
    },
    async linkIdea(id, ideaId, placeKey) {
      const idea = trips.get(id)?.ideas.find((i) => i.id === ideaId);
      if (!idea) return false;
      idea.placeKey = placeKey;
      return true;
    },
    async tripsFor(memberId, limit) {
      return [...trips.values()]
        .filter((t) => t.members.has(memberId))
        .sort((a, b) => b.meta.createdAt - a.meta.createdAt)
        .slice(0, limit)
        .map((t) => ({ meta: structuredClone(t.meta), memberCount: t.members.size }));
    },
  };
}
