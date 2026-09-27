import { readFile } from "node:fs/promises";
import path from "node:path";

export { getDb, hasMongo } from "@/lib/mongo";
import { auth } from "@/lib/auth";
import { ObjectId } from "mongodb";
import { db } from "@/lib/db";
import { canTextPlans, sendPlanText } from "@/lib/imessage/sendPlan";
import { decodePlan } from "@/lib/plan/share";
import type { IdentityProvider } from "../identity";

/** PlaNYt accounts (Better Auth): a signed-in traveler takes part as themselves, on any device. */
export const accountIdentity: IdentityProvider = {
  async current(request) {
    const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
    return session ? { userId: session.user.id, name: session.user.name, photoUrl: session.user.image ?? null } : null;
  },
  loginUrl: (returnTo) => `/login?next=${encodeURIComponent(returnTo)}`,
};

/**
 * Once the group agrees, the day goes into each member's saved trips (the
 * same "savedTrips" collection as the planner's Save), so it's on every
 * device they sign in on. Guests, who have no account, are skipped.
 */
export async function saveForMembers(trip: { id: string; title: string; code: string; userIds: string[] }): Promise<void> {
  if (!trip.userIds.length) return;
  const savedAt = new Date().toISOString();
  await db.collection("savedTrips").bulkWrite(
    trip.userIds.map((userId) => ({
      updateOne: {
        filter: { owner: `user:${userId}`, id: `trip-${trip.id}` },
        update: { $set: { id: `trip-${trip.id}`, title: `${trip.title} (with friends)`.slice(0, 180), code: trip.code, owner: `user:${userId}`, updatedAt: new Date() }, $setOnInsert: { savedAt } },
        upsert: true,
      },
    })),
  );
}

/**
 * Texts the approved day to every account member with a phone number (the
 * iMessage bot, as "Text it to me" does). Guests and accounts without a number
 * are skipped; one failed text never stops the others.
 */
export async function textMembers(trip: { code: string; userIds: string[]; intro: string }): Promise<void> {
  const request = decodePlan(trip.code);
  if (!canTextPlans() || !request?.stops.length || !trip.userIds.length) return;
  // Better Auth keeps users in "user", keyed by an ObjectId.
  const ids = [...trip.userIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)), ...trip.userIds];
  const users = await db.collection<{ _id: ObjectId | string; phoneNumber?: string | null }>("user").find({ _id: { $in: ids } }, { projection: { phoneNumber: 1 } }).toArray();
  const phones = [...new Set(users.flatMap((u) => (u.phoneNumber ? [u.phoneNumber] : [])))];
  for (const phone of phones) {
    await sendPlanText(phone, request, trip.intro).catch((error: unknown) => {
      console.error("[trips] couldn't text the approved plan:", error instanceof Error ? error.message : error);
    });
  }
}

/** The ~30k NYC places bundled for Discover (built by scripts/build-poi-data.mjs). */
export async function readPoiRows(): Promise<unknown[]> {
  const raw = await readFile(path.join(process.cwd(), "src/lib/discover/poi-data.json"), "utf8");
  return (JSON.parse(raw) as { places: unknown[] }).places;
}

export { searchLocal } from "@/lib/discover/sources";
export { fallbackIntent } from "@/lib/discover/intent";
export type { Intent, Candidate as DiscoverCandidate } from "@/lib/discover/types";

/** The app's Gemini client: the same model and key as the planner's assistant (/api/assistant). */
export { geminiJson, geminiKey } from "@/lib/llm/gemini";
export { resolveDestination } from "@/lib/osm/nominatim";
export { suggestAddresses } from "@/lib/nyc/geosearch";
export { guardrail, TRAVEL_SCOPE } from "@/lib/discover/scope";
