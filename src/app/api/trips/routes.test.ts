import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/plan/profile";
import { encodePlan } from "@/lib/plan/share";
import type { StopInput } from "@/lib/plan/types";
import { POST as createTrip } from "./route";
import { GET as getTrip } from "./[id]/route";
import { POST as joinTrip } from "./[id]/join/route";
import { POST as addCandidate } from "./[id]/candidates/route";
import { POST as vote } from "./[id]/vote/route";
import { POST as lock } from "./[id]/lock/route";

const met: StopInput = { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, visitMin: 150, attractionId: "met" };
const bridge: StopInput = { key: "brooklyn-bridge", name: "Brooklyn Bridge walk", lat: 40.7118, lon: -74.0035, visitMin: 45, attractionId: "brooklyn-bridge" };

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
  it("runs a whole group trip over HTTP", async () => {
    let res = await createTrip(post({ name: "Khyati", code }));
    expect(res.status).toBe(200);
    const { trip, organizerKey } = await res.json();
    expect(trip.title).toBe("Saturday in NYC");

    res = await joinTrip(post({ name: "Rishi" }), ctx(trip.id));
    const { memberId } = await res.json();

    res = await addCandidate(post({ memberId, stop: bridge }), ctx(trip.id));
    expect((await res.json()).candidates).toHaveLength(2);

    res = await vote(post({ memberId, stopKey: "met", on: true }), ctx(trip.id));
    expect(res.status).toBe(200);

    res = await lock(post({ organizerKey }), ctx(trip.id));
    expect((await res.json()).lockedCode).toEqual(expect.any(String));

    res = await vote(post({ memberId, stopKey: "met", on: false }), ctx(trip.id));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This plan is locked." });

    res = await getTrip(new Request("http://test/api"), ctx(trip.id));
    expect(res.status).toBe(200);
  });

  it("rejects a plan code that doesn't decode", async () => {
    const res = await createTrip(post({ name: "Khyati", code: "not-a-plan" }));
    expect(res.status).toBe(400);
  });

  it("404s a malformed trip id", async () => {
    const res = await getTrip(new Request("http://test/api"), ctx("bad"));
    expect(res.status).toBe(404);
  });

  it("rejects places outside New York City", async () => {
    const { trip, memberId } = await (await createTrip(post({ name: "Khyati", code }))).json();
    const res = await addCandidate(post({ memberId, stop: { ...bridge, key: "london", lat: 51.5, lon: -0.12 } }), ctx(trip.id));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "That place isn't in New York City." });
  });
});
