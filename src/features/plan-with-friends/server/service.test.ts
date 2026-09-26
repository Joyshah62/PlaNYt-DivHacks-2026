import { beforeEach, describe, expect, it } from "vitest";
import { decodePlan, DEFAULT_PROFILE, type StopInput } from "../bridge/index";
import type { Avatar } from "../core/avatars";
import type { TripSettings } from "../core/types";
import { memoryBackend, type MemoryEntry } from "./memory";
import { createTripService, TripError, type TripService } from "./service";

const met: StopInput = { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, visitMin: 150, attractionId: "met" };
const park: StopInput = { key: "central-park", name: "Central Park", lat: 40.774, lon: -73.971, visitMin: 90, attractionId: "central-park" };
const bridge: StopInput = { key: "brooklyn-bridge", name: "Brooklyn Bridge walk", lat: 40.7118, lon: -74.0035, visitMin: 45, attractionId: "brooklyn-bridge" };
const fox: Avatar = { emoji: "🦊", color: "orange" };
const octo: Avatar = { emoji: "🐙", color: "violet" };

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

let store: Map<string, MemoryEntry>;
let svc: TripService;
let clock = 1_000_000;

beforeEach(() => {
  clock = 1_000_000;
  store = new Map();
  svc = createTripService(memoryBackend(store), () => clock++);
});

const start = (stops: StopInput[] = [met, park]) => svc.create({ title: "Saturday in NYC", settings, stops, name: "Khyati", avatar: fox });
const status = (p: Promise<unknown>) => p.then(() => 0, (e) => (e instanceof TripError ? e.status : -1));
const votesFor = (trip: { candidates: { stop: StopInput; votes: string[] }[] }, key: string) => trip.candidates.find((c) => c.stop.key === key)?.votes;

describe("trip service: rooms and members", () => {
  it("creates a room where the host has an avatar and has voted for every seed stop", async () => {
    const { trip, memberId } = await start();
    expect(trip.id).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(trip.hostId).toBe(memberId);
    expect(trip.members[memberId]).toMatchObject({ name: "Khyati", avatar: fox });
    expect(trip.candidates.map((c) => [c.stop.key, c.votes])).toEqual([
      ["met", [memberId]],
      ["central-park", [memberId]],
    ]);
    expect(trip.consensus).toMatchObject({ total: 1, confirmed: [], reason: "waiting" });
  });

  it("can start empty", async () => {
    const { trip } = await start([]);
    expect(trip.candidates).toEqual([]);
    expect(trip.consensus.reason).toBe("no-draft");
  });

  it("returns 404 for an unknown trip", async () => {
    expect(await status(svc.get("nope123456"))).toBe(404);
  });

  it("lets a friend join with an avatar, suggest and vote", async () => {
    const { trip } = await start();
    const { memberId: rishi, trip: joined } = await svc.join(trip.id, "Rishi", octo);
    expect(joined.members[rishi]).toMatchObject({ name: "Rishi", avatar: octo });
    let t = await svc.addCandidate(trip.id, rishi, bridge);
    expect(t.candidates.find((c) => c.stop.key === "brooklyn-bridge")).toMatchObject({ addedBy: rishi, votes: [rishi] });
    t = await svc.vote(trip.id, rishi, "met", true);
    expect(votesFor(t, "met")).toHaveLength(2);
    t = await svc.vote(trip.id, rishi, "met", false);
    expect(votesFor(t, "met")).toHaveLength(1);
  });

  it("counts suggesting a place that's already there as a vote", async () => {
    const { trip, memberId } = await start();
    const { memberId: rishi } = await svc.join(trip.id, "Rishi", octo);
    const t = await svc.addCandidate(trip.id, rishi, met);
    expect(t.candidates).toHaveLength(2);
    expect(t.candidates[0]).toMatchObject({ addedBy: memberId });
    expect(votesFor(t, "met")).toHaveLength(2);
  });

  it("rejects edits from people who haven't joined, and votes for unknown places", async () => {
    const { trip, memberId } = await start();
    expect(await status(svc.vote(trip.id, "stranger1234", "met", true))).toBe(403);
    expect(await status(svc.confirm(trip.id, "stranger1234", true))).toBe(403);
    expect(await status(svc.vote(trip.id, memberId, "moma", true))).toBe(404);
  });

  it("caps a trip at 30 candidates and 12 members", async () => {
    const { trip, memberId } = await start();
    for (let i = 0; i < 28; i++) await svc.addCandidate(trip.id, memberId, { ...bridge, key: `p${i}`, name: `Place ${i}` });
    expect(await status(svc.addCandidate(trip.id, memberId, bridge))).toBe(400);
    for (let i = 0; i < 11; i++) await svc.join(trip.id, `Friend ${i}`, octo);
    expect(await status(svc.join(trip.id, "One too many", octo))).toBe(400);
  });

  it("upgrades trips saved before avatars and hosts existed", async () => {
    const { trip, memberId } = await start();
    const entry = store.get(trip.id)!;
    (entry.members as Map<string, unknown>).set(memberId, "Khyati");
    const { hostId, ...rest } = entry.meta;
    entry.meta = { ...rest, organizerId: hostId } as never;
    const t = await svc.get(trip.id);
    expect(t.hostId).toBe(memberId);
    expect(t.members[memberId].name).toBe("Khyati");
    expect(t.members[memberId].avatar.emoji).toBeTruthy();
  });
});

describe("trip service: removing places", () => {
  it("lets whoever suggested a place remove it, votes and all", async () => {
    const { trip, memberId } = await start();
    const { memberId: rishi } = await svc.join(trip.id, "Rishi", octo);
    await svc.vote(trip.id, rishi, "met", true);
    const t = await svc.removeCandidate(trip.id, memberId, "met");
    expect(t.candidates.map((c) => c.stop.key)).toEqual(["central-park"]);
  });

  it("doesn't let anyone else remove it", async () => {
    const { trip } = await start();
    const { memberId: rishi } = await svc.join(trip.id, "Rishi", octo);
    expect(await status(svc.removeCandidate(trip.id, rishi, "met"))).toBe(403);
    expect(await status(svc.removeCandidate(trip.id, rishi, "nope"))).toBe(404);
  });

  it("lets a removed place be suggested again from scratch", async () => {
    const { trip, memberId } = await start();
    await svc.removeCandidate(trip.id, memberId, "met");
    const t = await svc.addCandidate(trip.id, memberId, met);
    expect(t.candidates.find((c) => c.stop.key === "met")?.votes).toEqual([memberId]);
  });
});

describe("trip service: where everyone starts", () => {
  const astor = { lat: 40.72914, lon: -73.99098 };
  const astoria = { lat: 40.77504, lon: -73.91203 };
  const bedStuy = { lat: 40.6868, lon: -73.9418 };

  it("rounds a starting point and shows only the area", async () => {
    const { trip, memberId } = await start();
    const t = await svc.setStart(trip.id, memberId, astor);
    const s = t.members[memberId].start!;
    expect(s.area).toMatch(/^near /);
    expect(s.lat).not.toBe(astor.lat);
    expect(Math.abs(s.lat - astor.lat)).toBeLessThan(0.002);
  });

  it("starts the day at the stop with the shortest worst-case trip", async () => {
    const { trip, memberId } = await start([met, bridge]);
    const { memberId: rishi } = await svc.join(trip.id, "Rishi", octo);
    await svc.setStart(trip.id, memberId, astoria);
    const t = await svc.setStart(trip.id, rishi, bedStuy);
    expect(t.fairness?.starts).toBe(2);
    const pick = t.fairness!.firstStop!;
    expect(["met", "brooklyn-bridge"]).toContain(pick.key);
    expect(Object.keys(pick.perMember).sort()).toEqual([memberId, rishi].sort());
    expect(t.draft?.origin?.label).toBe(`Start at ${pick.name}`);
    expect(t.fairness?.meetup?.key).toMatch(/^meetup-/);
  });

  it("lets a voted-in meetup station start the day instead", async () => {
    const { trip, memberId } = await start([met]);
    const { memberId: rishi } = await svc.join(trip.id, "Rishi", octo);
    await svc.setStart(trip.id, memberId, astoria);
    const withStarts = await svc.setStart(trip.id, rishi, bedStuy);
    const m = withStarts.fairness!.meetup!;
    const t = await svc.addCandidate(trip.id, rishi, { key: m.key, name: m.name, lat: m.lat, lon: m.lon, visitMin: 10, attractionId: null });
    expect(t.draft?.origin?.label).toBe(m.name);
    expect(t.draft?.stops.map((s) => s.key)).toEqual(["met"]);
  });

  it("rejects starting points outside the city through the route schema", async () => {
    const { StartBody } = await import("./schema");
    expect(StartBody.safeParse({ memberId: "member123", point: { lat: 51.5, lon: -0.12 } }).success).toBe(false);
  });
});

describe("trip service: ideas and chat", () => {
  it("posts ideas in order, with upvotes", async () => {
    const { trip, memberId } = await start();
    const { memberId: rishi } = await svc.join(trip.id, "Rishi", octo);
    await svc.addIdea(trip.id, memberId, "dessert later?");
    let t = await svc.addIdea(trip.id, rishi, "I'm free after 3");
    expect(t.ideas.map((i) => [i.text, i.memberId])).toEqual([
      ["dessert later?", memberId],
      ["I'm free after 3", rishi],
    ]);
    t = await svc.voteIdea(trip.id, rishi, t.ideas[0].id, true);
    expect(t.ideas[0].votes).toEqual([rishi]);
    t = await svc.voteIdea(trip.id, rishi, t.ideas[0].id, false);
    expect(t.ideas[0].votes).toEqual([]);
  });

  it("links an idea to the place it became", async () => {
    const { trip, memberId } = await start();
    const withIdea = await svc.addIdea(trip.id, memberId, "something with a view");
    const t = await svc.linkIdea(trip.id, memberId, withIdea.ideas[0].id, "met");
    expect(t.ideas[0].placeKey).toBe("met");
    expect(await status(svc.linkIdea(trip.id, memberId, withIdea.ideas[0].id, "not-a-place"))).toBe(404);
  });

  it("keeps chat open after the plan locks, and needs you to have joined", async () => {
    const { trip, memberId } = await start();
    await svc.confirm(trip.id, memberId, true);
    expect((await svc.addIdea(trip.id, memberId, "see you at 10!")).ideas).toHaveLength(1);
    expect(await status(svc.addIdea(trip.id, "stranger1234", "hi"))).toBe(403);
  });

  it("rejects over-long ideas through the schema", async () => {
    const { IdeaBody } = await import("./schema");
    expect(IdeaBody.safeParse({ memberId: "member123", text: "x".repeat(281) }).success).toBe(false);
    expect(IdeaBody.safeParse({ memberId: "member123", text: "   " }).success).toBe(false);
  });
});

describe("trip service: deciding together", () => {
  it("locks when everyone is in, and freezes the trip", async () => {
    const { trip, memberId } = await start();
    const { memberId: rishi } = await svc.join(trip.id, "Rishi", octo);
    let t = await svc.confirm(trip.id, memberId, true);
    expect(t.lockedCode).toBeNull();
    expect(t.consensus).toMatchObject({ confirmed: [memberId], pending: [rishi] });

    t = await svc.confirm(trip.id, rishi, true);
    expect(t.consensus.reason).toBe("unanimous");
    expect(decodePlan(t.lockedCode ?? "")?.stops.map((s) => s.key)).toEqual(["met", "central-park"]);

    expect(await status(svc.vote(trip.id, rishi, "met", false))).toBe(409);
    expect(await status(svc.addCandidate(trip.id, rishi, bridge))).toBe(409);
    expect(await status(svc.confirm(trip.id, rishi, false))).toBe(409);
    expect(await status(svc.join(trip.id, "Joy", octo))).toBe(409);
  });

  it("stops counting a confirmation once the day changes", async () => {
    const { trip, memberId } = await start();
    const { memberId: rishi } = await svc.join(trip.id, "Rishi", octo);
    await svc.confirm(trip.id, memberId, true);
    const t = await svc.addCandidate(trip.id, rishi, bridge);
    expect(t.consensus.confirmed).toEqual([]);
    expect(t.consensus.stale).toEqual([memberId]);
  });

  it("can take back an I'm in", async () => {
    const { trip, memberId } = await start();
    await svc.join(trip.id, "Rishi", octo);
    await svc.confirm(trip.id, memberId, true);
    const t = await svc.confirm(trip.id, memberId, false);
    expect(t.consensus.confirmed).toEqual([]);
  });

  it("refuses I'm in when there's no day yet", async () => {
    const { trip, memberId } = await start([]);
    expect(await status(svc.confirm(trip.id, memberId, true))).toBe(400);
  });

  it("lets a majority lock after the deadline", async () => {
    const { trip, memberId } = await start();
    const { memberId: rishi } = await svc.join(trip.id, "Rishi", octo);
    await svc.join(trip.id, "Joy", fox);
    await svc.setDeadline(trip.id, rishi, clock + 1000);
    await svc.confirm(trip.id, memberId, true);
    let t = await svc.confirm(trip.id, rishi, true);
    expect(t.lockedCode).toBeNull();
    clock += 5000;
    t = await svc.get(trip.id);
    expect(t.consensus.reason).toBe("majority-after-deadline");
    expect(t.lockedCode).toEqual(expect.any(String));
  });

  it("only accepts deadlines in the next two weeks", async () => {
    const { trip, memberId } = await start();
    expect(await status(svc.setDeadline(trip.id, memberId, clock - 1))).toBe(400);
    expect(await status(svc.setDeadline(trip.id, memberId, clock + 15 * 24 * 3600 * 1000))).toBe(400);
    expect((await svc.setDeadline(trip.id, memberId, null)).deadline).toBeNull();
  });
});
