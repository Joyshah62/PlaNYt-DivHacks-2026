import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/plan/profile";
import { decodePlan } from "@/lib/plan/share";
import type { StopInput } from "@/lib/plan/types";
import { memoryBackend } from "./memory";
import { createTripService, TripError, type TripService } from "./service";
import type { TripSettings } from "./types";

const met: StopInput = { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, visitMin: 150, attractionId: "met" };
const park: StopInput = { key: "central-park", name: "Central Park", lat: 40.774, lon: -73.971, visitMin: 90, attractionId: "central-park" };
const bridge: StopInput = { key: "brooklyn-bridge", name: "Brooklyn Bridge walk", lat: 40.7118, lon: -74.0035, visitMin: 45, attractionId: "brooklyn-bridge" };

const settings: TripSettings = {
  date: "2026-10-03",
  startMin: 600,
  endMin: 1260,
  mode: "transit",
  crowd: "avoid",
  origin: null,
  returnToOrigin: false,
  profile: DEFAULT_PROFILE,
  meals: { lunch: false, dinner: false },
};

let svc: TripService;
let tick = 1000;

beforeEach(() => {
  tick = 1000;
  svc = createTripService(memoryBackend(new Map()), () => tick++);
});

const start = (stops: StopInput[] = [met, park]) => svc.create({ title: "Saturday in NYC", settings, stops, name: "Khyati" });
const status = (p: Promise<unknown>) => p.then(() => 0, (e) => (e instanceof TripError ? e.status : -1));
const votesFor = (trip: { candidates: { stop: StopInput; votes: string[] }[] }, key: string) => trip.candidates.find((c) => c.stop.key === key)?.votes;

describe("trip service", () => {
  it("creates a trip where the organizer has voted for every seed stop", async () => {
    const { trip, memberId, organizerKey } = await start();
    expect(trip.id).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(trip.organizerId).toBe(memberId);
    expect(trip.members).toEqual({ [memberId]: "Khyati" });
    expect(trip.candidates.map((c) => [c.stop.key, c.votes])).toEqual([
      ["met", [memberId]],
      ["central-park", [memberId]],
    ]);
    expect(organizerKey.length).toBeGreaterThan(20);
    expect(JSON.stringify(trip)).not.toContain(organizerKey);
  });

  it("returns 404 for an unknown trip", async () => {
    expect(await status(svc.get("nope123456"))).toBe(404);
  });

  it("lets a friend join, suggest and vote", async () => {
    const { trip } = await start();
    const { memberId: rishi } = await svc.join(trip.id, "Rishi");
    let t = await svc.addCandidate(trip.id, rishi, bridge);
    expect(t.candidates.find((c) => c.stop.key === "brooklyn-bridge")).toMatchObject({ addedBy: rishi, votes: [rishi] });
    t = await svc.vote(trip.id, rishi, "met", true);
    expect(votesFor(t, "met")).toHaveLength(2);
    t = await svc.vote(trip.id, rishi, "met", false);
    expect(votesFor(t, "met")).toHaveLength(1);
  });

  it("counts suggesting a place that's already there as a vote", async () => {
    const { trip, memberId } = await start();
    const { memberId: rishi } = await svc.join(trip.id, "Rishi");
    const t = await svc.addCandidate(trip.id, rishi, met);
    expect(t.candidates).toHaveLength(2);
    expect(t.candidates[0]).toMatchObject({ addedBy: memberId });
    expect(votesFor(t, "met")).toHaveLength(2);
  });

  it("rejects edits from people who haven't joined", async () => {
    const { trip } = await start();
    expect(await status(svc.vote(trip.id, "stranger1234", "met", true))).toBe(403);
    expect(await status(svc.addCandidate(trip.id, "stranger1234", bridge))).toBe(403);
  });

  it("rejects votes for places not on the trip", async () => {
    const { trip, memberId } = await start();
    expect(await status(svc.vote(trip.id, memberId, "moma", true))).toBe(404);
  });

  it("caps a trip at 30 candidates", async () => {
    const { trip, memberId } = await start();
    for (let i = 0; i < 28; i++) {
      await svc.addCandidate(trip.id, memberId, { ...bridge, key: `p${i}`, name: `Place ${i}` });
    }
    expect((await svc.get(trip.id)).candidates).toHaveLength(30);
    expect(await status(svc.addCandidate(trip.id, memberId, bridge))).toBe(400);
  });

  it("only the organizer key can lock, and locking freezes the trip", async () => {
    const { trip, organizerKey } = await start();
    const { memberId: rishi } = await svc.join(trip.id, "Rishi");
    expect(await status(svc.lock(trip.id, "wrong-key-wrong-key"))).toBe(403);

    const locked = await svc.lock(trip.id, organizerKey);
    expect(decodePlan(locked.lockedCode ?? "")?.stops.map((s) => s.key)).toEqual(["met", "central-park"]);

    expect(await status(svc.vote(trip.id, rishi, "met", false))).toBe(409);
    expect(await status(svc.addCandidate(trip.id, rishi, bridge))).toBe(409);
    expect(await status(svc.join(trip.id, "Joy"))).toBe(409);
    expect((await svc.lock(trip.id, organizerKey)).lockedCode).toBe(locked.lockedCode);
  });

  it("refuses to lock when no place has a vote", async () => {
    const { trip, organizerKey } = await start([]);
    expect(await status(svc.lock(trip.id, organizerKey))).toBe(400);
  });
});
