import { clock, decodePlan } from "../bridge/index";
import { getDb, hasMongo, saveForMembers, textMembers } from "../bridge/server";
import { memoryBackend } from "./memory";
import { mongoBackend } from "./mongo";
import { createTripService, type TripHooks, type TripService } from "./service";

let service: TripService | null = null;

/** Account members' ids are "u_" + their user id (see member.ts); guests have none to save to. */
const userIdsOf = (memberIds: string[]) => memberIds.filter((m) => m.startsWith("u_")).map((m) => m.slice(2));

/** "🎉 Khyati approved the plan for Saturday in NYC (Sat, Oct 3, from 10am)." */
function approvedLine(title: string, date: string, hostName: string, code: string): string {
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const start = decodePlan(code)?.startMin;
  return `🎉 ${hostName} approved the plan for ${title} (${day}${start != null ? `, from ${clock(start)}` : ""}). Here's the day:`;
}

const hooks: TripHooks = {
  // The approved day lands in every member's saved trips, on every device they sign in on, and by text.
  onLock: async ({ id, title, date, code, memberIds, hostName }) => {
    const userIds = userIdsOf(memberIds);
    // Each on its own: a failed save mustn't hide a failed text, or the other way round.
    const [saved, texted] = await Promise.allSettled([saveForMembers({ id, title, code, userIds }), textMembers({ code, userIds, intro: approvedLine(title, date, hostName, code) })]);
    if (saved.status === "rejected") console.error(`[trips] ${id}: couldn't save the approved day to members' trips:`, saved.reason instanceof Error ? saved.reason.message : saved.reason);
    if (texted.status === "rejected") console.error(`[trips] ${id}: couldn't text the approved day:`, texted.reason instanceof Error ? texted.reason.message : texted.reason);
  },
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
