import { MongoClient } from "mongodb";
import { afterAll, describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../bridge/index";
import type { StopInput } from "../bridge/index";
import { mongoBackend } from "./mongo";
import { createTripService } from "./service";
import type { TripSettings } from "../core/types";

const uri = process.env.MONGODB_URI;

describe.skipIf(!uri)("mongo backend (live Atlas)", () => {
  const client = new MongoClient(uri ?? "mongodb://unused");
  const db = client.db("roam_test");

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("runs create, join, suggest, vote, confirm and lock against real MongoDB", async () => {
    const svc = createTripService(mongoBackend(async () => db));
    const settings: TripSettings = { date: "2026-10-03", startMin: 600, endMin: 1260, mode: "transit", crowd: "avoid", origin: null, returnToOrigin: false, profile: DEFAULT_PROFILE, meals: { lunch: false, dinner: false } };
    const met: StopInput = { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, visitMin: 150, attractionId: "met" };
    const bridge: StopInput = { key: "brooklyn-bridge", name: "Brooklyn Bridge walk", lat: 40.7118, lon: -74.0035, visitMin: 45, attractionId: "brooklyn-bridge" };

    const { trip, memberId: host } = await svc.create({ title: "Test trip", settings, stops: [met], name: "Khyati", avatar: { emoji: "🦊", color: "orange" } });
    const { memberId } = await svc.join(trip.id, "Rishi", { emoji: "🐙", color: "violet" });
    await svc.addCandidate(trip.id, memberId, bridge);
    await svc.addCandidate(trip.id, memberId, bridge);
    const voted = await svc.vote(trip.id, memberId, "met", true);

    expect(voted.members[memberId]).toMatchObject({ name: "Rishi", avatar: { emoji: "🐙", color: "violet" } });
    expect(voted.candidates.map((c) => [c.stop.key, c.votes.length])).toEqual([
      ["met", 2],
      ["brooklyn-bridge", 1],
    ]);
    await svc.addCandidate(trip.id, host, { ...bridge, key: "temp", name: "Temp" });
    expect((await svc.removeCandidate(trip.id, host, "temp")).candidates.map((c) => c.stop.key)).toEqual(["met", "brooklyn-bridge"]);
    await svc.setDeadline(trip.id, host, Date.now() + 3600_000);
    expect((await svc.confirm(trip.id, host, true)).lockedCode).toBeNull();
    const locked = await svc.confirm(trip.id, memberId, true);
    expect(locked.consensus.reason).toBe("unanimous");
    expect(locked.lockedCode).toEqual(expect.any(String));
    expect(locked.deadline).toEqual(expect.any(Number));
    expect((await svc.get(trip.id)).lockedCode).toBe(locked.lockedCode);

    const indexes = await db.collection("trips").indexes();
    expect(indexes.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0)).toBe(true);
  }, 30000);
});
