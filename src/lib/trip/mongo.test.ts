import { MongoClient } from "mongodb";
import { afterAll, describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/plan/profile";
import type { StopInput } from "@/lib/plan/types";
import { mongoBackend } from "./mongo";
import { createTripService } from "./service";
import type { TripSettings } from "./types";

const uri = process.env.MONGODB_URI;

describe.skipIf(!uri)("mongo backend (live Atlas)", () => {
  const client = new MongoClient(uri ?? "mongodb://unused");
  const db = client.db("roam_test");

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("runs create, join, suggest, vote and lock against real MongoDB", async () => {
    const svc = createTripService(mongoBackend(async () => db));
    const settings: TripSettings = { date: "2026-10-03", startMin: 600, endMin: 1260, mode: "transit", crowd: "avoid", origin: null, returnToOrigin: false, profile: DEFAULT_PROFILE, meals: { lunch: false, dinner: false } };
    const met: StopInput = { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, visitMin: 150, attractionId: "met" };
    const bridge: StopInput = { key: "brooklyn-bridge", name: "Brooklyn Bridge walk", lat: 40.7118, lon: -74.0035, visitMin: 45, attractionId: "brooklyn-bridge" };

    const { trip, organizerKey } = await svc.create({ title: "Test trip", settings, stops: [met], name: "Khyati" });
    const { memberId } = await svc.join(trip.id, "Rishi");
    await svc.addCandidate(trip.id, memberId, bridge);
    await svc.addCandidate(trip.id, memberId, bridge);
    const voted = await svc.vote(trip.id, memberId, "met", true);

    expect(voted.members[memberId]).toBe("Rishi");
    expect(voted.candidates.map((c) => [c.stop.key, c.votes.length])).toEqual([
      ["met", 2],
      ["brooklyn-bridge", 1],
    ]);
    expect((await svc.lock(trip.id, organizerKey)).lockedCode).toEqual(expect.any(String));

    const indexes = await db.collection("trips").indexes();
    expect(indexes.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0)).toBe(true);
  }, 30000);
});
