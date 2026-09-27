import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PROFILE, encodePlan, nycToday, type StopInput } from "../../bridge/index";

// Signed in as whoever the x-test-user header names; no header is someone signed out.
const saved = vi.hoisted(() => [] as { id: string; code: string; userIds: string[] }[]);
vi.mock("../../bridge/server", async (original) => ({
  ...(await original<typeof import("../../bridge/server")>()),
  accountIdentity: {
    current: async (request: Request) => {
      const user = request.headers.get("x-test-user");
      return user ? { userId: user, name: user[0].toUpperCase() + user.slice(1, -1), photoUrl: null } : null;
    },
    loginUrl: (returnTo: string) => `/login?next=${encodeURIComponent(returnTo)}`,
  },
  saveForMembers: async (trip: { id: string; code: string; userIds: string[] }) => {
    saved.push(trip);
  },
}));
import { POST as addCandidate } from "./candidates";
import { POST as confirm } from "./confirm";
import { POST as createTrip } from "./create";
import { POST as setDeadline } from "./deadline";
import { GET as getTrip } from "./get";
import { POST as joinTrip } from "./join";
import { GET as myTrips } from "./mine";
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

const post = (body: unknown, user: string | null = "khyati1") =>
  new Request("http://test/api", { method: "POST", headers: { "content-type": "application/json", ...(user && { "x-test-user": user }) }, body: JSON.stringify(body) });
const as = (user: string) => new Request("http://test/api", { headers: { "x-test-user": user } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("trip routes", () => {
  it("runs a whole group decision over HTTP", async () => {
    let res = await createTrip(post({ name: "Khyati", avatar: fox, code }));
    expect(res.status).toBe(200);
    const { trip, memberId: host } = await res.json();
    expect(host).toBe("u_khyati1");
    expect(trip.title).toBe("Saturday in NYC");
    expect(trip.members[host].avatar).toEqual(fox);

    // Rishi joins as his account, whatever name the form sent.
    res = await joinTrip(post({ name: "Someone", avatar: octo }, "rishi1"), ctx(trip.id));
    const { memberId, trip: joined } = await res.json();
    expect(memberId).toBe("u_rishi1");
    expect(joined.members[memberId].name).toBe("Rishi");

    res = await addCandidate(post({ memberId, stop: bridge }, "rishi1"), ctx(trip.id));
    expect((await res.json()).candidates).toHaveLength(2);

    res = await vote(post({ memberId, stopKey: "met", on: true }, "rishi1"), ctx(trip.id));
    expect(res.status).toBe(200);

    res = await setDeadline(post({ memberId, at: Date.now() + 3600_000 }, "rishi1"), ctx(trip.id));
    expect((await res.json()).deadline).toEqual(expect.any(Number));

    res = await confirm(post({ on: true }, "khyati1"), ctx(trip.id));
    expect((await res.json()).lockedCode).toBeNull();
    res = await confirm(post({ on: true }, "rishi1"), ctx(trip.id));
    const lockedCode = (await res.json()).lockedCode;
    expect(lockedCode).toEqual(expect.any(String));
    // The agreed day goes to both accounts' saved trips, once.
    await vi.waitFor(() => expect(saved).toEqual([{ id: trip.id, title: "Saturday in NYC", code: lockedCode, userIds: ["khyati1", "rishi1"] }]));

    res = await vote(post({ memberId, stopKey: "met", on: false }, "rishi1"), ctx(trip.id));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This plan is locked." });

    res = await getTrip(new Request("http://test/api"), ctx(trip.id));
    expect(res.status).toBe(200);

    // Both see it on their accounts, on any device.
    const mine = await (await myTrips(as("rishi1"))).json();
    expect(mine.trips).toEqual([expect.objectContaining({ id: trip.id, members: 2, decided: true, hosting: false })]);
  });

  it("turns away someone signed out, even with a member's id", async () => {
    const { trip } = await (await createTrip(post({ name: "Khyati", avatar: fox, code }))).json();
    const res = await vote(post({ memberId: "u_khyati1", stopKey: "met", on: false }, null), ctx(trip.id));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in to take part in this trip." });
    expect((await myTrips(new Request("http://test/api"))).status).toBe(401);
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
