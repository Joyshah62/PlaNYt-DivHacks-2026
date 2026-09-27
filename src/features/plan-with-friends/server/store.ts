import { getDb, hasMongo, saveForMembers } from "../bridge/server";
import { memoryBackend } from "./memory";
import { mongoBackend } from "./mongo";
import { createTripService, type TripHooks, type TripService } from "./service";

let service: TripService | null = null;

/** Account members' ids are "u_" + their user id (see member.ts); guests have none to save to. */
const userIdsOf = (memberIds: string[]) => memberIds.filter((m) => m.startsWith("u_")).map((m) => m.slice(2));

const hooks: TripHooks = {
  // The agreed day lands in every member's saved trips, on every device they sign in on.
  onLock: ({ id, title, code, memberIds }) => saveForMembers({ id, title, code, userIds: userIdsOf(memberIds) }),
};

export function getTripStore(): TripService {
  if (service) return service;
  if (hasMongo()) {
    service = createTripService(mongoBackend(getDb), Date.now, hooks);
  } else {
    if (process.env.NODE_ENV === "production") console.warn("[trips] MONGODB_URI is not set: trips live in memory and vanish on restart.");
    service = createTripService(memoryBackend(), Date.now, hooks);
  }
  return service;
}
