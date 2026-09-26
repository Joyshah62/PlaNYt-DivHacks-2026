import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, encodePlan, nycToday, type StopInput } from "../../bridge/index";
import { POST as addCandidate } from "./candidates";
import { POST as confirm } from "./confirm";
import { POST as createTrip } from "./create";
import { POST as setDeadline } from "./deadline";
import { GET as getTrip } from "./get";
import { POST as joinTrip } from "./join";
import { POST as vote } from "./vote";

const met: StopInput = { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, visitMin: 150, attractionId: "met" };
const bridge: StopInput = { key: "brooklyn-bridge", name: "Brooklyn Bridge walk", lat: 40.7118, lon: -74.0035, visitMin: 45, attractionId: "brooklyn-bridge" };
const fox = { emoji: "🦊", color: "orange" };
const octo = { emoji: "🐙", color: "violet" };

const code = encodePlan({
  stops: [met],
  date: "2026-10-03",
  startMin: 600,
  endMin: 1260,
  mode: "transit",
  crowd: "avoid",
  origin: null,
  returnToOrigin: false,
  profile: DEFAULT_PROFILE,
  meals: { lunch: false, dinner: false },
});

const post = (body: unknown) =>
  new Request("http://test/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("trip routes", () => {
  it("runs a whole group decision over HTTP", async () => {
    let res = await createTrip(post({ name: "Khyati", avatar: fox, code }));
    expect(res.status).toBe(200);
    const { trip, memberId: host } = await res.json();
    expect(trip.title).toBe("Saturday in NYC");
    expect(trip.members[host].avatar).toEqual(fox);

    res = await joinTrip(post({ name: "Rishi", avatar: octo }), ctx(trip.id));
    const { memberId } = await res.json();

    res = await addCandidate(post({ memberId, stop: bridge }), ctx(trip.id));
    expect((await res.json()).candidates).toHaveLength(2);

    res = await vote(post({ memberId, stopKey: "met", on: true }), ctx(trip.id));
    expect(res.status).toBe(200);

    res = await setDeadline(post({ memberId, at: Date.now() + 3600_000 }), ctx(trip.id));
    expect((await res.json()).deadline).toEqual(expect.any(Number));

    res = await confirm(post({ memberId: host, on: true }), ctx(trip.id));
    expect((await res.json()).lockedCode).toBeNull();
    res = await confirm(post({ memberId, on: true }), ctx(trip.id));
    expect((await res.json()).lockedCode).toEqual(expect.any(String));

    res = await vote(post({ memberId, stopKey: "met", on: false }), ctx(trip.id));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This plan is locked." });

    res = await getTrip(new Request("http://test/api"), ctx(trip.id));
    expect(res.status).toBe(200);
  });

  it("starts an empty room for a date", async () => {
    const res = await createTrip(post({ name: "Khyati", avatar: fox, date: nycToday() }));
    expect(res.status).toBe(200);
    expect((await res.json()).trip.candidates).toEqual([]);
  });

  it("rejects a past date, a broken plan code and a missing avatar", async () => {
    expect((await createTrip(post({ name: "Khyati", avatar: fox, date: "2020-01-01" }))).status).toBe(400);
    expect((await createTrip(post({ name: "Khyati", avatar: fox, code: "not-a-plan" }))).status).toBe(400);
    const res = await createTrip(post({ name: "Khyati", code }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Pick an emoji and a color." });
  });

  it("404s a malformed trip id", async () => {
    const res = await getTrip(new Request("http://test/api"), ctx("bad"));
    expect(res.status).toBe(404);
  });

  it("rejects places outside New York City", async () => {
    const { trip, memberId } = await (await createTrip(post({ name: "Khyati", avatar: fox, code }))).json();
    const res = await addCandidate(post({ memberId, stop: { ...bridge, key: "london", lat: 51.5, lon: -0.12 } }), ctx(trip.id));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "That place isn't in New York City." });
  });
});
