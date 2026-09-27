# Plan with Friends (Group Trip Voting) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A group of friends suggests and votes on places for one NYC day. Roam's existing optimizer schedules the top-voted stops into a draft day, and the organizer locks it into a normal Roam plan link.

**Architecture:** The feature is self-contained under `src/lib/trip/`, `src/app/api/trips/`, `src/app/trip/` and `src/components/trip/`. One module holds all the rules (`service.ts`) and runs on top of a small storage interface, which has two implementations: in-memory for tests and for dev without a database, and MongoDB Atlas for real use. Each trip is one MongoDB document, and votes use atomic `$addToSet` / `$pull` updates. The trip page checks for updates every 4 seconds and builds the draft day by calling the existing `POST /api/plan`. The only changes to existing files are a link in `Itinerary.tsx` and one prop in `PlannerView.tsx`.

**Tech Stack:** Next.js 16.3.5 (App Router, Turbopack), React 19.2, TypeScript, Zod 4, Vitest 5, Tailwind 4, MongoDB Atlas with the official `mongodb` Node.js driver.

**Spec:** `docs/superpowers/specs/2026-09-26-group-trip-voting-design.md`

## Global Constraints

- **This is not the Next.js you know.** Before writing a route handler or page, read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`. `params` and `searchParams` are Promises and must be awaited. Type them with the global helpers `RouteContext<"/api/trips/[id]">` and `PageProps<"/trip/[id]">`, which `next dev` / `next typegen` generates.
- GET route handlers are not cached by default in this version. Don't add `dynamic` config.
- Every error response has the shape `{ error: string }`, the same as `/api/plan`.
- The optimizer accepts at most 10 stops (`MAX_DAY_STOPS = 10`). A trip holds at most 30 candidates (`MAX_CANDIDATES = 30`).
- Names are 1–30 characters. Trip IDs are 10 URL-safe characters (`/^[A-Za-z0-9_-]{10}$/`).
- Trip documents expire 30 days after the last write, using a TTL index on `expiresAt` (`TRIP_TTL_SECONDS = 2592000`).
- MongoDB settings: `MONGODB_URI` (required for real storage) and `MONGODB_DB` (optional, default `roam`). The collection is `trips`. All database access goes through `getDb()` in `src/lib/mongo.ts`, so later features (Atlas Search) reuse the same connection.
- Only a SHA-256 hash of the organizer key is stored, and the key is never returned except to its creator.
- Exact user-facing text:
  - "This plan is locked."
  - "Join the trip first."
  - "This trip has expired or the link is wrong."
  - "That place isn't on this trip."
  - "This trip has enough ideas. Vote on the ones already here."
  - "Only the organizer can lock the plan."
  - "Vote for at least one place first."
  - "Trips are unavailable right now."
  - "Couldn't update the draft day."
- `localStorage` access always goes inside try/catch, following the pattern in `src/lib/plan/share.ts`.
- Comments: default to none, and at most one short line explaining *why*.
- Run tests with `npx vitest run <path>`. Tests sit next to the code as `*.test.ts`, and the `@/` alias maps to `src/`.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Changes since the design doc

This plan makes these changes to the first version of the design. The spec has already been updated to match.
1. **Lock computes the plan code on the server** from its own vote state. The client no longer sends a `code`, so it can't lock a different plan than the one the votes produced. The lock body is `{ organizerKey }`.
2. **The entry point is a link, not an inline form.** The Itinerary gets a **Plan with friends** link to `/trip/start?plan={code}`. That page asks the organizer's name and creates the trip. This keeps `PlannerView.tsx` to a one-prop change.
3. **`Trip` gains an `organizerId` field**, so the UI can label the organizer and show who locked the plan.
4. **`store.ts` is split** into `backend.ts` (the storage interface), `service.ts` (rules), `memory.ts` and `mongo.ts`. The rules are written once and tested against the memory backend.
5. **MongoDB Atlas replaces Upstash Redis**, to qualify for the hackathon's MongoDB challenge.

## File map

| File | Responsibility |
|---|---|
| `src/lib/trip/types.ts` | `Trip`, `Candidate`, `TripSettings`, limits |
| `src/lib/trip/rank.ts` | `rankCandidates()`, `draftRequest()` |
| `src/lib/trip/backend.ts` | `TripBackend` storage interface, `TripMeta`, `CandidateRecord`, TTL |
| `src/lib/trip/memory.ts` | In-memory `TripBackend` |
| `src/lib/mongo.ts` | Shared MongoDB client: `getDb()` (reused later by Atlas Search) |
| `src/lib/trip/mongo.ts` | MongoDB `TripBackend`: one document per trip in `trips` |
| `src/lib/trip/service.ts` | `createTripService()` with every rule, and `TripError` |
| `src/lib/trip/store.ts` | `getTripStore()`: picks MongoDB or memory |
| `src/lib/trip/schema.ts` | Zod request-body schemas |
| `src/lib/trip/http.ts` | `readBody()`, `tripId()`, `respond()` for route handlers |
| `src/lib/trip/local.ts` | Browser identity (`memberId`, `organizerKey`) in `localStorage` |
| `src/lib/trip/client.ts` | `tripApi()` fetch wrapper and `TripApiError` |
| `src/app/api/trips/**/route.ts` | Six thin route handlers |
| `src/app/trip/start/page.tsx`, `src/components/trip/TripStart.tsx` | Organizer's name form, which creates the trip |
| `src/app/trip/[id]/page.tsx`, `src/components/trip/TripView.tsx` | The trip page |
| `src/components/trip/CandidateList.tsx` | Ranked places with vote toggles |
| `src/components/trip/DraftDay.tsx` | Compact timed day from a `DayPlan` |
| `src/components/trip/useDraftPlan.ts` | Calls `/api/plan` only when the top stops change |
| `src/components/plan/Itinerary.tsx` (modify) | Optional `friendsHref` link next to **Copy link** |
| `src/components/plan/PlannerView.tsx` (modify) | Passes `friendsHref` |

---

### Task 1: Trip types and ranking

**Files:**
- Create: `src/lib/trip/types.ts`
- Create: `src/lib/trip/rank.ts`
- Test: `src/lib/trip/rank.test.ts`

**Interfaces:**
- Consumes: `PlanRequest`, `StopInput` from `@/lib/plan/types`
- Produces:
  - `MAX_DAY_STOPS = 10`, `MAX_CANDIDATES = 30`
  - `type TripSettings = Omit<PlanRequest, "stops" | "keepOrder">`
  - `interface Candidate { stop: StopInput; addedBy: string; addedAt: number; votes: string[] }`
  - `interface Trip { id; title; createdAt; organizerId; settings: TripSettings; members: Record<string,string>; candidates: Candidate[]; lockedCode: string | null }`
  - `rankCandidates(trip: Trip): { inDay: Candidate[]; waiting: Candidate[] }`
  - `draftRequest(trip: Trip): PlanRequest | null`

- [ ] **Step 1: Create the types**

`src/lib/trip/types.ts`:

```ts
import type { PlanRequest, StopInput } from "@/lib/plan/types";

export const MAX_DAY_STOPS = 10;
export const MAX_CANDIDATES = 30;

export type TripSettings = Omit<PlanRequest, "stops" | "keepOrder">;

export interface Candidate {
  stop: StopInput;
  addedBy: string;
  addedAt: number;
  votes: string[];
}

export interface Trip {
  id: string;
  title: string;
  createdAt: number;
  organizerId: string;
  settings: TripSettings;
  members: Record<string, string>;
  candidates: Candidate[];
  lockedCode: string | null;
}
```

- [ ] **Step 2: Write the failing test**

`src/lib/trip/rank.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/plan/profile";
import { draftRequest, rankCandidates } from "./rank";
import type { Candidate, Trip, TripSettings } from "./types";

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

function cand(key: string, votes: string[], addedAt: number): Candidate {
  return { stop: { key, name: key, lat: 40.75, lon: -73.98, visitMin: 60, attractionId: null }, addedBy: "m1", addedAt, votes };
}

function trip(candidates: Candidate[]): Trip {
  return { id: "abcdefghij", title: "Saturday in NYC", createdAt: 0, organizerId: "m1", settings, members: { m1: "Khyati" }, candidates, lockedCode: null };
}

const keys = (list: Candidate[]) => list.map((c) => c.stop.key);

describe("rankCandidates", () => {
  it("orders by votes, then by who suggested first", () => {
    const { inDay } = rankCandidates(trip([cand("a", ["m1"], 3), cand("b", ["m1", "m2"], 2), cand("c", ["m2"], 1)]));
    expect(keys(inDay)).toEqual(["b", "c", "a"]);
  });

  it("keeps zero-vote places out of the day", () => {
    const { inDay, waiting } = rankCandidates(trip([cand("a", [], 1), cand("b", ["m1"], 2)]));
    expect(keys(inDay)).toEqual(["b"]);
    expect(keys(waiting)).toEqual(["a"]);
  });

  it("caps the day at 10 stops", () => {
    const many = Array.from({ length: 12 }, (_, i) => cand(`s${i}`, ["m1"], i));
    const { inDay, waiting } = rankCandidates(trip(many));
    expect(inDay).toHaveLength(10);
    expect(keys(waiting)).toEqual(["s10", "s11"]);
  });
});

describe("draftRequest", () => {
  it("is null when nothing has a vote", () => {
    expect(draftRequest(trip([cand("a", [], 1)]))).toBeNull();
  });

  it("combines the trip settings with the ranked stops", () => {
    const a = cand("a", ["m1"], 1);
    expect(draftRequest(trip([a]))).toEqual({ ...settings, stops: [a.stop] });
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npx vitest run src/lib/trip/rank.test.ts`
Expected: FAIL, "Failed to resolve import "./rank"".

- [ ] **Step 4: Implement the ranking**

`src/lib/trip/rank.ts`:

```ts
import type { PlanRequest } from "@/lib/plan/types";
import { MAX_DAY_STOPS, type Candidate, type Trip } from "./types";

export function rankCandidates(trip: Trip): { inDay: Candidate[]; waiting: Candidate[] } {
  const sorted = [...trip.candidates].sort((a, b) => b.votes.length - a.votes.length || a.addedAt - b.addedAt);
  const inDay = sorted.filter((c) => c.votes.length > 0).slice(0, MAX_DAY_STOPS);
  const picked = new Set(inDay);
  return { inDay, waiting: sorted.filter((c) => !picked.has(c)) };
}

export function draftRequest(trip: Trip): PlanRequest | null {
  const stops = rankCandidates(trip).inDay.map((c) => c.stop);
  return stops.length ? { ...trip.settings, stops } : null;
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx vitest run src/lib/trip/rank.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/trip/types.ts src/lib/trip/rank.ts src/lib/trip/rank.test.ts
git commit -m "Add trip types and vote ranking for group trips"
```

---

### Task 2: Trip service with the memory backend

**Files:**
- Create: `src/lib/trip/backend.ts`
- Create: `src/lib/trip/memory.ts`
- Create: `src/lib/trip/service.ts`
- Test: `src/lib/trip/service.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `draftRequest()`. `encodePlan()` from `@/lib/plan/share`.
- Produces:
  - `interface TripBackend` (methods below), `TripMeta`, `CandidateRecord`, `TRIP_TTL_SECONDS`
  - `memoryBackend(trips?: Map<string, MemoryEntry>): TripBackend`
  - `class TripError extends Error { status: number }`
  - `createTripService(db: TripBackend, now?: () => number)`, which returns:
    - `create(input: { title: string; settings: TripSettings; stops: StopInput[]; name: string }): Promise<{ trip: Trip; memberId: string; organizerKey: string }>`
    - `get(id: string): Promise<Trip>`
    - `join(id: string, name: string): Promise<{ trip: Trip; memberId: string }>`
    - `addCandidate(id: string, memberId: string, stop: StopInput): Promise<Trip>`
    - `vote(id: string, memberId: string, stopKey: string, on: boolean): Promise<Trip>`
    - `lock(id: string, organizerKey: string): Promise<Trip>`
  - `type TripService = ReturnType<typeof createTripService>`

- [ ] **Step 1: Create the storage interface**

`src/lib/trip/backend.ts`:

```ts
import type { StopInput } from "@/lib/plan/types";
import type { TripSettings } from "./types";

export const TRIP_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface TripMeta {
  id: string;
  title: string;
  createdAt: number;
  organizerId: string;
  organizerKeyHash: string;
  settings: TripSettings;
  lockedCode: string | null;
}

export interface CandidateRecord {
  stop: StopInput;
  addedBy: string;
  addedAt: number;
}

/** Each call is atomic on its own; the rules that combine them live in service.ts. */
export interface TripBackend {
  getMeta(id: string): Promise<TripMeta | null>;
  setMeta(meta: TripMeta): Promise<void>;
  getMembers(id: string): Promise<Record<string, string>>;
  setMember(id: string, memberId: string, name: string): Promise<void>;
  getCandidates(id: string): Promise<Record<string, CandidateRecord>>;
  /** False when that stop key is already a candidate. */
  addCandidate(id: string, record: CandidateRecord): Promise<boolean>;
  getVotes(id: string, stopKeys: string[]): Promise<Record<string, string[]>>;
  setVote(id: string, stopKey: string, memberId: string, on: boolean): Promise<void>;
  touch(id: string, stopKeys: string[]): Promise<void>;
}
```

- [ ] **Step 2: Create the memory backend**

`src/lib/trip/memory.ts`:

```ts
import type { CandidateRecord, TripBackend, TripMeta } from "./backend";

export interface MemoryEntry {
  meta: TripMeta;
  members: Map<string, string>;
  cands: Map<string, CandidateRecord>;
  votes: Map<string, Set<string>>;
}

function shared(): Map<string, MemoryEntry> {
  // globalThis survives dev hot reloads; a server restart still clears it.
  const g = globalThis as typeof globalThis & { __roamTrips?: Map<string, MemoryEntry> };
  return (g.__roamTrips ??= new Map());
}

export function memoryBackend(trips: Map<string, MemoryEntry> = shared()): TripBackend {
  return {
    async getMeta(id) {
      const meta = trips.get(id)?.meta;
      return meta ? structuredClone(meta) : null;
    },
    async setMeta(meta) {
      const entry = trips.get(meta.id);
      if (entry) entry.meta = structuredClone(meta);
      else trips.set(meta.id, { meta: structuredClone(meta), members: new Map(), cands: new Map(), votes: new Map() });
    },
    async getMembers(id) {
      return Object.fromEntries(trips.get(id)?.members ?? []);
    },
    async setMember(id, memberId, name) {
      trips.get(id)?.members.set(memberId, name);
    },
    async getCandidates(id) {
      return structuredClone(Object.fromEntries(trips.get(id)?.cands ?? []));
    },
    async addCandidate(id, record) {
      const entry = trips.get(id);
      if (!entry || entry.cands.has(record.stop.key)) return false;
      entry.cands.set(record.stop.key, structuredClone(record));
      return true;
    },
    async getVotes(id, stopKeys) {
      const entry = trips.get(id);
      return Object.fromEntries(stopKeys.map((key) => [key, [...(entry?.votes.get(key) ?? [])]]));
    },
    async setVote(id, stopKey, memberId, on) {
      const entry = trips.get(id);
      if (!entry) return;
      const set = entry.votes.get(stopKey) ?? new Set<string>();
      if (on) set.add(memberId);
      else set.delete(memberId);
      entry.votes.set(stopKey, set);
    },
    async touch() {},
  };
}
```

- [ ] **Step 3: Write the failing test**

`src/lib/trip/service.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and confirm it fails**

Run: `npx vitest run src/lib/trip/service.test.ts`
Expected: FAIL, "Failed to resolve import "./service"".

- [ ] **Step 5: Implement the service**

`src/lib/trip/service.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";
import { encodePlan } from "@/lib/plan/share";
import type { StopInput } from "@/lib/plan/types";
import type { TripBackend, TripMeta } from "./backend";
import { draftRequest } from "./rank";
import { MAX_CANDIDATES, type Trip, type TripSettings } from "./types";

export class TripError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const LOCKED = "This plan is locked.";
const newId = (bytes: number) => randomBytes(bytes).toString("base64url");
const hash = (key: string) => createHash("sha256").update(key).digest("hex");

export interface CreateTripInput {
  title: string;
  settings: TripSettings;
  stops: StopInput[];
  name: string;
}

export function createTripService(db: TripBackend, now: () => number = Date.now) {
  async function read(id: string): Promise<{ meta: TripMeta; trip: Trip }> {
    const meta = await db.getMeta(id);
    if (!meta) throw new TripError(404, "This trip has expired or the link is wrong.");
    const [members, records] = await Promise.all([db.getMembers(id), db.getCandidates(id)]);
    const votes = await db.getVotes(id, Object.keys(records));
    const candidates = Object.values(records)
      .sort((a, b) => a.addedAt - b.addedAt)
      .map((r) => ({ ...r, votes: votes[r.stop.key] ?? [] }));
    const trip: Trip = {
      id: meta.id,
      title: meta.title,
      createdAt: meta.createdAt,
      organizerId: meta.organizerId,
      settings: meta.settings,
      lockedCode: meta.lockedCode,
      members,
      candidates,
    };
    return { meta, trip };
  }

  async function editable(id: string, memberId: string) {
    const result = await read(id);
    if (result.trip.lockedCode) throw new TripError(409, LOCKED);
    if (!(memberId in result.trip.members)) throw new TripError(403, "Join the trip first.");
    return result;
  }

  async function saved(id: string): Promise<Trip> {
    const { trip } = await read(id);
    await db.touch(id, trip.candidates.map((c) => c.stop.key));
    return trip;
  }

  return {
    async create(input: CreateTripInput) {
      const id = newId(8).slice(0, 10);
      const memberId = newId(9);
      const organizerKey = newId(24);
      const at = now();
      await db.setMeta({ id, title: input.title, createdAt: at, organizerId: memberId, organizerKeyHash: hash(organizerKey), settings: input.settings, lockedCode: null });
      await db.setMember(id, memberId, input.name);
      for (const [i, stop] of input.stops.entries()) {
        if (await db.addCandidate(id, { stop, addedBy: memberId, addedAt: at + i })) await db.setVote(id, stop.key, memberId, true);
      }
      return { trip: await saved(id), memberId, organizerKey };
    },

    async get(id: string) {
      return (await read(id)).trip;
    },

    async join(id: string, name: string) {
      const { trip } = await read(id);
      if (trip.lockedCode) throw new TripError(409, LOCKED);
      const memberId = newId(9);
      await db.setMember(id, memberId, name);
      return { trip: await saved(id), memberId };
    },

    async addCandidate(id: string, memberId: string, stop: StopInput) {
      const { trip } = await editable(id, memberId);
      if (!trip.candidates.some((c) => c.stop.key === stop.key)) {
        if (trip.candidates.length >= MAX_CANDIDATES) throw new TripError(400, "This trip has enough ideas. Vote on the ones already here.");
        await db.addCandidate(id, { stop, addedBy: memberId, addedAt: now() });
      }
      await db.setVote(id, stop.key, memberId, true);
      return saved(id);
    },

    async vote(id: string, memberId: string, stopKey: string, on: boolean) {
      const { trip } = await editable(id, memberId);
      if (!trip.candidates.some((c) => c.stop.key === stopKey)) throw new TripError(404, "That place isn't on this trip.");
      await db.setVote(id, stopKey, memberId, on);
      return saved(id);
    },

    async lock(id: string, organizerKey: string) {
      const { meta, trip } = await read(id);
      if (hash(organizerKey) !== meta.organizerKeyHash) throw new TripError(403, "Only the organizer can lock the plan.");
      if (trip.lockedCode) return trip;
      const request = draftRequest(trip);
      if (!request) throw new TripError(400, "Vote for at least one place first.");
      await db.setMeta({ ...meta, lockedCode: encodePlan(request) });
      return saved(id);
    },
  };
}

export type TripService = ReturnType<typeof createTripService>;
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `npx vitest run src/lib/trip/service.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/trip/backend.ts src/lib/trip/memory.ts src/lib/trip/service.ts src/lib/trip/service.test.ts
git commit -m "Add group trip service with in-memory storage"
```

---

### Task 3: Request schemas, HTTP helpers and store selection

**Files:**
- Create: `src/lib/trip/schema.ts`
- Create: `src/lib/trip/http.ts`
- Create: `src/lib/trip/store.ts`
- Test: `src/lib/trip/http.test.ts`

**Interfaces:**
- Consumes: `StopSchema` from `@/lib/plan/schema`, `inNycArea` from `@/lib/osm/geo`, `TripError`, `createTripService`, `memoryBackend`
- Produces:
  - `TRIP_ID`, `CreateTripBody` `{ name, code }`, `JoinBody` `{ name }`, `CandidateBody` `{ memberId, stop }`, `VoteBody` `{ memberId, stopKey, on }`, `LockBody` `{ organizerKey }`
  - `readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>>`
  - `tripId(raw: string): string`, which throws a 404 `TripError` when malformed
  - `respond(work: () => Promise<unknown>): Promise<Response>`
  - `getTripStore(): TripService`

- [ ] **Step 1: Create the schemas**

`src/lib/trip/schema.ts`:

```ts
import { z } from "zod";
import { inNycArea } from "@/lib/osm/geo";
import { StopSchema } from "@/lib/plan/schema";

export const TRIP_ID = /^[A-Za-z0-9_-]{10}$/;

const Name = z.string().trim().min(1, "Add your name.").max(30, "Keep your name under 30 characters.");
const MemberId = z.string().regex(/^[A-Za-z0-9_-]{8,20}$/, "Join the trip first.");

export const CreateTripBody = z.object({ name: Name, code: z.string().min(1).max(4000) });
export const JoinBody = z.object({ name: Name });
export const CandidateBody = z.object({
  memberId: MemberId,
  stop: StopSchema.refine(inNycArea, { message: "That place isn't in New York City." }),
});
export const VoteBody = z.object({ memberId: MemberId, stopKey: z.string().min(1).max(80), on: z.boolean() });
export const LockBody = z.object({ organizerKey: z.string().min(16).max(64) });
```

- [ ] **Step 2: Write the failing test**

`src/lib/trip/http.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { readBody, respond, tripId } from "./http";
import { JoinBody } from "./schema";
import { TripError } from "./service";

const post = (body: string) => new Request("http://test/api", { method: "POST", body });

describe("respond", () => {
  it("returns the work's result as JSON", async () => {
    const res = await respond(async () => ({ ok: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("maps a TripError to its status and message", async () => {
    const res = await respond(async () => {
      throw new TripError(409, "This plan is locked.");
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This plan is locked." });
  });

  it("hides unexpected failures behind a 503", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await respond(async () => {
      throw new Error("database exploded");
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Trips are unavailable right now." });
    spy.mockRestore();
  });
});

describe("readBody", () => {
  it("rejects bodies that aren't JSON", async () => {
    await expect(readBody(post("not json"), JoinBody)).rejects.toMatchObject({ status: 400 });
  });

  it("returns the schema's first message on bad input", async () => {
    await expect(readBody(post(JSON.stringify({ name: "x".repeat(31) })), JoinBody)).rejects.toMatchObject({
      status: 400,
      message: "Keep your name under 30 characters.",
    });
  });

  it("returns parsed, trimmed data", async () => {
    expect(await readBody(post(JSON.stringify({ name: "  Rishi " })), JoinBody)).toEqual({ name: "Rishi" });
  });
});

describe("tripId", () => {
  it("accepts 10-character ids and 404s anything else", () => {
    expect(tripId("abcDEF12_-")).toBe("abcDEF12_-");
    expect(() => tripId("../etc")).toThrow(TripError);
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npx vitest run src/lib/trip/http.test.ts`
Expected: FAIL, "Failed to resolve import "./http"".

- [ ] **Step 4: Implement the HTTP helpers and store selection**

`src/lib/trip/http.ts`:

```ts
import type { z } from "zod";
import { TRIP_ID } from "./schema";
import { TripError } from "./service";

export async function readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new TripError(400, "Expected a JSON body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new TripError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
  return parsed.data;
}

export function tripId(raw: string): string {
  if (!TRIP_ID.test(raw)) throw new TripError(404, "This trip has expired or the link is wrong.");
  return raw;
}

export async function respond(work: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await work());
  } catch (error) {
    if (error instanceof TripError) return Response.json({ error: error.message }, { status: error.status });
    console.error("[trips]", error);
    return Response.json({ error: "Trips are unavailable right now." }, { status: 503 });
  }
}
```

`src/lib/trip/store.ts` (memory only for now; Task 9 adds MongoDB):

```ts
import { memoryBackend } from "./memory";
import { createTripService, type TripService } from "./service";

let service: TripService | null = null;

export function getTripStore(): TripService {
  return (service ??= createTripService(memoryBackend()));
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx vitest run src/lib/trip/http.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/trip/schema.ts src/lib/trip/http.ts src/lib/trip/store.ts src/lib/trip/http.test.ts
git commit -m "Add trip request schemas and route helpers"
```

---

### Task 4: Trip API routes

**Files:**
- Create: `src/app/api/trips/route.ts`
- Create: `src/app/api/trips/[id]/route.ts`
- Create: `src/app/api/trips/[id]/join/route.ts`
- Create: `src/app/api/trips/[id]/candidates/route.ts`
- Create: `src/app/api/trips/[id]/vote/route.ts`
- Create: `src/app/api/trips/[id]/lock/route.ts`
- Test: `src/app/api/trips/routes.test.ts`

**Interfaces:**
- Consumes: `readBody`, `respond`, `tripId`, all `*Body` schemas, `getTripStore`, `TripError`, `PlanRequestSchema`, `decodePlan`, `WEEKDAYS`, `weekdayOf`
- Produces the HTTP API:
  - `POST /api/trips` with `{ name, code }` returns `{ trip, memberId, organizerKey }`
  - `GET /api/trips/[id]` returns `Trip`
  - `POST /api/trips/[id]/join` with `{ name }` returns `{ trip, memberId }`
  - `POST /api/trips/[id]/candidates` with `{ memberId, stop }` returns `Trip`
  - `POST /api/trips/[id]/vote` with `{ memberId, stopKey, on }` returns `Trip`
  - `POST /api/trips/[id]/lock` with `{ organizerKey }` returns `Trip`

- [ ] **Step 1: Read the route handler docs**

Run: `sed -n 180,200p node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
Expected: the `RouteContext<'/users/[id]'>` example with `const { id } = await ctx.params`.

- [ ] **Step 2: Write the failing test**

`src/app/api/trips/routes.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npx vitest run src/app/api/trips/routes.test.ts`
Expected: FAIL, "Failed to resolve import "./route"".

- [ ] **Step 4: Implement the six route handlers**

`src/app/api/trips/route.ts`:

```ts
import { PlanRequestSchema } from "@/lib/plan/schema";
import { decodePlan } from "@/lib/plan/share";
import { WEEKDAYS, weekdayOf } from "@/lib/plan/time";
import { readBody, respond } from "@/lib/trip/http";
import { CreateTripBody } from "@/lib/trip/schema";
import { TripError } from "@/lib/trip/service";
import { getTripStore } from "@/lib/trip/store";

/** POST /api/trips - start a group trip from a plan link's code. */
export async function POST(request: Request) {
  return respond(async () => {
    const { name, code } = await readBody(request, CreateTripBody);
    const parsed = PlanRequestSchema.safeParse(decodePlan(code));
    if (!parsed.success) throw new TripError(400, "That plan link doesn't work.");
    const r = parsed.data;
    const settings = {
      date: r.date,
      startMin: r.startMin,
      endMin: r.endMin,
      mode: r.mode,
      crowd: r.crowd,
      origin: r.origin,
      returnToOrigin: r.returnToOrigin,
      profile: r.profile,
      meals: r.meals,
    };
    return getTripStore().create({ title: `${WEEKDAYS[weekdayOf(r.date)]} in NYC`, settings, stops: r.stops, name });
  });
}
```

`src/app/api/trips/[id]/route.ts`:

```ts
import { respond, tripId } from "@/lib/trip/http";
import { getTripStore } from "@/lib/trip/store";

/** GET /api/trips/[id] - the trip as everyone sees it. */
export async function GET(_request: Request, ctx: RouteContext<"/api/trips/[id]">) {
  return respond(async () => getTripStore().get(tripId((await ctx.params).id)));
}
```

`src/app/api/trips/[id]/join/route.ts`:

```ts
import { readBody, respond, tripId } from "@/lib/trip/http";
import { JoinBody } from "@/lib/trip/schema";
import { getTripStore } from "@/lib/trip/store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/join">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { name } = await readBody(request, JoinBody);
    return getTripStore().join(id, name);
  });
}
```

`src/app/api/trips/[id]/candidates/route.ts`:

```ts
import { readBody, respond, tripId } from "@/lib/trip/http";
import { CandidateBody } from "@/lib/trip/schema";
import { getTripStore } from "@/lib/trip/store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/candidates">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId, stop } = await readBody(request, CandidateBody);
    return getTripStore().addCandidate(id, memberId, stop);
  });
}
```

`src/app/api/trips/[id]/vote/route.ts`:

```ts
import { readBody, respond, tripId } from "@/lib/trip/http";
import { VoteBody } from "@/lib/trip/schema";
import { getTripStore } from "@/lib/trip/store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/vote">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId, stopKey, on } = await readBody(request, VoteBody);
    return getTripStore().vote(id, memberId, stopKey, on);
  });
}
```

`src/app/api/trips/[id]/lock/route.ts`:

```ts
import { readBody, respond, tripId } from "@/lib/trip/http";
import { LockBody } from "@/lib/trip/schema";
import { getTripStore } from "@/lib/trip/store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/lock">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { organizerKey } = await readBody(request, LockBody);
    return getTripStore().lock(id, organizerKey);
  });
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx vitest run src/app/api/trips/routes.test.ts`
Expected: PASS, 4 tests. (`2026-10-03` is a Saturday, so the title is "Saturday in NYC".)

- [ ] **Step 6: Type-check with generated route types**

Run: `npx next typegen && npx tsc --noEmit`
Expected: no errors. `RouteContext` resolves from the generated types.

- [ ] **Step 7: Smoke-test against the dev server**

Run (with `npm run dev` running):

```bash
curl -s -X POST localhost:3000/api/trips -H 'content-type: application/json' -d '{"name":"Khyati","code":"bad"}'
curl -s localhost:3000/api/trips/abcdefghij
```

Expected: `{"error":"That plan link doesn't work."}`, then `{"error":"This trip has expired or the link is wrong."}`

- [ ] **Step 8: Commit**

```bash
git add src/app/api/trips
git commit -m "Add group trip API routes"
```

---

### Task 5: Browser identity and API client

**Files:**
- Create: `src/lib/trip/local.ts`
- Create: `src/lib/trip/client.ts`
- Test: `src/lib/trip/local.test.ts`

**Interfaces:**
- Produces:
  - `interface TripIdentity { memberId: string; organizerKey?: string }`
  - `readIdentityRaw(id: string): string`, `parseIdentity(raw: string): TripIdentity | null`
  - `subscribeIdentity(onChange: () => void): () => void`
  - `storeIdentity(id: string, identity: TripIdentity): boolean`, `clearIdentity(id: string): void`
  - `class TripApiError extends Error { status: number }`
  - `tripApi<T>(path: string, body?: unknown): Promise<T>`. `path` is relative to `/api/trips`, so `""` means `/api/trips` and `"/abc/vote"` means `/api/trips/abc/vote`. Without a body it sends a GET, and with a body a JSON POST.

- [ ] **Step 1: Write the failing test**

`src/lib/trip/local.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearIdentity, parseIdentity, readIdentityRaw, storeIdentity } from "./local";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("trip identity", () => {
  it("round-trips through localStorage", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    vi.stubGlobal("window", { dispatchEvent: () => true });
    vi.stubGlobal("Event", class { constructor(readonly type: string) {} });
    expect(storeIdentity("abcdefghij", { memberId: "m1234567", organizerKey: "k".repeat(32) })).toBe(true);
    expect(parseIdentity(readIdentityRaw("abcdefghij"))).toEqual({ memberId: "m1234567", organizerKey: "k".repeat(32) });
    clearIdentity("abcdefghij");
    expect(readIdentityRaw("abcdefghij")).toBe("");
  });

  it("treats garbage as no identity", () => {
    expect(parseIdentity("")).toBeNull();
    expect(parseIdentity("{not json")).toBeNull();
    expect(parseIdentity(JSON.stringify({ memberId: 5 }))).toBeNull();
  });

  it("survives storage that throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readIdentityRaw("abcdefghij")).toBe("");
    expect(storeIdentity("abcdefghij", { memberId: "m1234567" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/trip/local.test.ts`
Expected: FAIL, "Failed to resolve import "./local"".

- [ ] **Step 3: Implement identity storage and the client**

`src/lib/trip/local.ts`:

```ts
export interface TripIdentity {
  memberId: string;
  organizerKey?: string;
}

const EVENT = "roam:trip-identity";
const key = (id: string) => `roam:trip:${id}`;

export function readIdentityRaw(id: string): string {
  try {
    return localStorage.getItem(key(id)) ?? "";
  } catch {
    return "";
  }
}

export function parseIdentity(raw: string): TripIdentity | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<TripIdentity>;
    if (typeof v.memberId !== "string") return null;
    return typeof v.organizerKey === "string" ? { memberId: v.memberId, organizerKey: v.organizerKey } : { memberId: v.memberId };
  } catch {
    return null;
  }
}

export function subscribeIdentity(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function storeIdentity(id: string, identity: TripIdentity): boolean {
  try {
    localStorage.setItem(key(id), JSON.stringify(identity));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

export function clearIdentity(id: string): void {
  try {
    localStorage.removeItem(key(id));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* nothing stored */
  }
}
```

`src/lib/trip/client.ts`:

```ts
export class TripApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function tripApi<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(
    `/api/trips${path}`,
    body === undefined
      ? { cache: "no-store" }
      : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
  );
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new TripApiError(res.status, typeof data.error === "string" ? data.error : "Something went wrong.");
  return data as T;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/lib/trip/local.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trip/local.ts src/lib/trip/client.ts src/lib/trip/local.test.ts
git commit -m "Add browser identity storage and client for group trips"
```

---

### Task 6: Start page and trip page (join, suggest, vote)

**Files:**
- Create: `src/app/trip/start/page.tsx`
- Create: `src/components/trip/TripStart.tsx`
- Create: `src/app/trip/[id]/page.tsx`
- Create: `src/components/trip/TripView.tsx`
- Create: `src/components/trip/CandidateList.tsx`

**Interfaces:**
- Consumes: `tripApi`, `TripApiError`, all of `local.ts`, `rankCandidates`, `Trip`, `MAX_CANDIDATES`, `StopPicker` and `stopFromAttraction` from `@/components/plan/StopPicker`, `Button` from `@/components/ui/button`, `Input` from `@/components/ui/input`, `BRAND` from `@/lib/plan/display`, `clock` from `@/lib/plan/time`
- Produces:
  - `TripStart({ code }: { code: string | null })`
  - `TripView({ id }: { id: string })`
  - `CandidateList({ trip, memberId, locked, onVote }: { trip: Trip; memberId: string | null; locked: boolean; onVote: (stopKey: string, on: boolean) => void })`
  - Routes `/trip/start?plan=…` and `/trip/[id]`

This task is UI work, so it's verified in the browser instead of with unit tests. The rules underneath are already tested in Tasks 1–5.

- [ ] **Step 1: Create the start page**

`src/app/trip/start/page.tsx`:

```tsx
import type { Metadata } from "next";
import { TripStart } from "@/components/trip/TripStart";
import { BRAND } from "@/lib/plan/display";

export const metadata: Metadata = { title: `Plan with friends · ${BRAND.name} ${BRAND.suffix}` };

export default async function TripStartPage({ searchParams }: PageProps<"/trip/start">) {
  const { plan } = await searchParams;
  const code = (Array.isArray(plan) ? plan[0] : plan)?.slice(0, 4000) || null;
  return <TripStart code={code} />;
}
```

`src/components/trip/TripStart.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tripApi } from "@/lib/trip/client";
import { storeIdentity } from "@/lib/trip/local";
import type { Trip } from "@/lib/trip/types";

export function TripStart({ code }: { code: string | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { trip, memberId, organizerKey } = await tripApi<{ trip: Trip; memberId: string; organizerKey: string }>("", { name, code });
      if (!storeIdentity(trip.id, { memberId, organizerKey })) {
        setError("This browser can't save your organizer key. Open Roam in a normal (not private) window to organize a trip.");
        setBusy(false);
        return;
      }
      router.replace(`/trip/${trip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the trip.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="font-display text-4xl">Plan with friends</h1>
      {code ? (
        <form onSubmit={start} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Friends you invite can suggest places and vote. You lock the final day.</p>
          <label className="text-sm font-medium" htmlFor="organizer-name">
            Your name
          </label>
          <Input id="organizer-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus required />
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Starting…" : "Start the trip"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Build a day first, then press Plan with friends.{" "}
          <Link href="/plan" className="font-medium text-brand underline-offset-4 hover:underline">
            Go to the planner
          </Link>
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Create the candidate list**

`src/components/trip/CandidateList.tsx`:

```tsx
"use client";

import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { rankCandidates } from "@/lib/trip/rank";
import type { Candidate, Trip } from "@/lib/trip/types";

export function CandidateList({
  trip,
  memberId,
  locked,
  onVote,
}: {
  trip: Trip;
  memberId: string | null;
  locked: boolean;
  onVote: (stopKey: string, on: boolean) => void;
}) {
  const { inDay, waiting } = rankCandidates(trip);

  const row = (c: Candidate) => {
    const mine = memberId !== null && c.votes.includes(memberId);
    return (
      <li key={c.stop.key} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{c.stop.name}</p>
          <p className="text-xs text-muted-foreground">
            Added by {trip.members[c.addedBy] ?? "someone"}
            {c.votes.length > 0 && ` · ${c.votes.map((v) => trip.members[v] ?? "?").join(", ")}`}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={mine}
          aria-label={`${mine ? "Remove your vote for" : "Vote for"} ${c.stop.name}`}
          disabled={!memberId || locked}
          onClick={() => onVote(c.stop.key, !mine)}
          className={cn(
            "flex min-w-12 flex-col items-center rounded-lg border px-2 py-1 text-xs leading-tight tabular-nums transition disabled:opacity-60",
            mine ? "border-brand bg-brand-soft text-brand" : "border-border bg-background hover:bg-muted",
          )}
        >
          <ChevronUp className="size-3.5" aria-hidden />
          <span className="text-sm font-bold">{c.votes.length}</span>
        </button>
      </li>
    );
  };

  return (
    <div>
      <ul>{inDay.map(row)}</ul>
      {waiting.length > 0 && (
        <>
          <p className="mt-3 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">Not in the day yet</p>
          <ul>{waiting.map(row)}</ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the trip page and view**

`src/app/trip/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { TripView } from "@/components/trip/TripView";
import { BRAND } from "@/lib/plan/display";

export const metadata: Metadata = { title: `Group trip · ${BRAND.name} ${BRAND.suffix}` };

export default async function TripPage({ params }: PageProps<"/trip/[id]">) {
  const { id } = await params;
  return <TripView id={id} />;
}
```

`src/components/trip/TripView.tsx`. This version has join, suggest and vote; Task 7 adds the draft day and lock:

```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { stopFromAttraction, StopPicker } from "@/components/plan/StopPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StopInput } from "@/lib/plan/types";
import { tripApi, TripApiError } from "@/lib/trip/client";
import { clearIdentity, parseIdentity, readIdentityRaw, storeIdentity, subscribeIdentity, type TripIdentity } from "@/lib/trip/local";
import { MAX_CANDIDATES, type Trip } from "@/lib/trip/types";
import { CandidateList } from "./CandidateList";

const POLL_MS = 4000;

export function TripView({ id }: { id: string }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [missing, setMissing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [picking, setPicking] = useState(false);
  const [sessionIdentity, setSessionIdentity] = useState<TripIdentity | null>(null);
  const [copied, setCopied] = useState(false);

  const raw = useSyncExternalStore(subscribeIdentity, () => readIdentityRaw(id), () => "");
  const identity = useMemo(() => parseIdentity(raw), [raw]) ?? sessionIdentity;
  const memberId = identity && trip && identity.memberId in trip.members ? identity.memberId : null;
  const locked = !!trip?.lockedCode;

  const refresh = useCallback(async () => {
    try {
      setTrip(await tripApi<Trip>(`/${id}`));
      setOffline(false);
    } catch (e) {
      if (e instanceof TripApiError && e.status === 404) setMissing(true);
      else setOffline(true);
    }
  }, [id]);

  useEffect(() => {
    refresh();
    if (locked) return;
    const timer = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh, locked]);

  async function act(work: () => Promise<Trip>) {
    setError(null);
    try {
      setTrip(await work());
    } catch (e) {
      if (e instanceof TripApiError && e.status === 403) clearIdentity(id);
      setError(e instanceof Error ? e.message : "Something went wrong.");
      refresh();
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await tripApi<{ trip: Trip; memberId: string }>(`/${id}/join`, { name });
      setTrip(result.trip);
      if (!storeIdentity(id, { memberId: result.memberId })) setSessionIdentity({ memberId: result.memberId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join.");
    }
  }

  const vote = (stopKey: string, on: boolean) => memberId && act(() => tripApi<Trip>(`/${id}/vote`, { memberId, stopKey, on }));
  const suggest = (stop: StopInput) => {
    setPicking(false);
    if (memberId) act(() => tripApi<Trip>(`/${id}/candidates`, { memberId, stop }));
  };

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/trip/${id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy this page's address to invite friends.");
    }
  }

  if (missing) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">This trip has expired or the link is wrong.</p>
        <Link href="/plan" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
          Plan a day instead
        </Link>
      </main>
    );
  }
  if (!trip) return <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">Loading trip…</main>;

  const organizer = trip.members[trip.organizerId] ?? "the organizer";

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 lg:grid lg:grid-cols-2 lg:items-start">
      <header className="flex flex-col gap-2 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-4xl">{trip.title}</h1>
          <Button size="sm" variant="outline" className="rounded-full" onClick={copyInvite}>
            {copied ? "Link copied" : "Copy invite link"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(trip.members).map(([mid, n]) => (
            <span key={mid} className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs">
              {n}
              {mid === trip.organizerId && " · organizer"}
            </span>
          ))}
        </div>
        {offline && <p className="text-xs text-muted-foreground">Reconnecting…</p>}
        {sessionIdentity && <p className="text-xs text-muted-foreground">Your vote won&apos;t be remembered on this device.</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </header>

      <section className="flex flex-col gap-4">
        {!memberId && !locked && (
          <form onSubmit={join} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">{organizer} invited you to plan this day</p>
            <p className="text-xs text-muted-foreground">Add your name to suggest places and vote. No account needed.</p>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="Your name" required />
              <Button type="submit" disabled={!name.trim()}>
                Join
              </Button>
            </div>
          </form>
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Places</h2>
          <p className="mb-2 text-xs text-muted-foreground">Most votes go in the day. Up to 10 stops.</p>
          <CandidateList trip={trip} memberId={memberId} locked={locked} onVote={vote} />
          {memberId && !locked && !picking && (
            <Button variant="outline" className="mt-3 w-full" onClick={() => setPicking(true)} disabled={trip.candidates.length >= MAX_CANDIDATES}>
              Suggest a place
            </Button>
          )}
          {picking && (
            <div className="mt-3">
              <StopPicker
                stops={trip.candidates.map((c) => c.stop)}
                suggestions={[]}
                onAdd={suggest}
                onToggle={(a) => suggest(stopFromAttraction(a))}
                onInspect={() => {}}
                full={trip.candidates.length >= MAX_CANDIDATES}
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx next typegen && npx tsc --noEmit && npx eslint src/components/trip src/app/trip`
Expected: no errors. If `react-hooks/set-state-in-effect` flags the `refresh()` call inside `useEffect`, keep the code as is and add `// eslint-disable-next-line react-hooks/set-state-in-effect -- polling an external API` above it. The state updates happen after an `await`, not synchronously.

- [ ] **Step 5: Verify in two browsers**

Task 8 adds the Plan with friends button, so for now start a trip by hand. With `npm run dev` running:
1. Open `/plan`, pick the Met and Central Park, then build the day.
2. Copy the `?plan=` value from the address bar and open `/trip/start?plan=<that value>`.
3. Enter "Khyati" and press **Start the trip**. You should land on `/trip/<id>` with both places, each at 1 vote.
4. Open the same `/trip/<id>` URL in a private window and join as "Rishi".
5. Press **Suggest a place**, then pick Brooklyn Bridge walk. It should appear with 1 vote from Rishi.
6. Press the vote button on the Met. Within 4 seconds, the first window should show 2 votes on the Met.
7. Stop the dev server. The first window should show "Reconnecting…". Restart the server; trips are kept in memory, so the page then shows "This trip has expired or the link is wrong." That's expected with the memory backend.

- [ ] **Step 6: Commit**

```bash
git add src/app/trip src/components/trip
git commit -m "Add trip start page and group voting view"
```

---

### Task 7: Draft day and organizer lock

**Files:**
- Create: `src/components/trip/useDraftPlan.ts`
- Create: `src/components/trip/DraftDay.tsx`
- Modify: `src/components/trip/TripView.tsx`

**Interfaces:**
- Consumes: `draftRequest`, `DayPlan` from `@/lib/plan/types`, `clock` and `duration` from `@/lib/plan/time`, `CROWD_COLOR`, `CROWD_LABEL` and `LEG_VERB` from `@/lib/plan/display`
- Produces:
  - `useDraftPlan(trip: Trip | null): { plan: DayPlan | null; updating: boolean; error: string | null }`
  - `DraftDay({ plan, updating, error, locked }: { plan: DayPlan | null; updating: boolean; error: string | null; locked: boolean })`

- [ ] **Step 1: Create the draft-plan hook**

`src/components/trip/useDraftPlan.ts`:

```ts
"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayPlan } from "@/lib/plan/types";
import { draftRequest } from "@/lib/trip/rank";
import type { Trip } from "@/lib/trip/types";

export function useDraftPlan(trip: Trip | null) {
  // Polling hands back a new Trip every 4 s; only a change in the request itself re-plans.
  const signature = useMemo(() => {
    const request = trip ? draftRequest(trip) : null;
    return request ? JSON.stringify(request) : "";
  }, [trip]);
  const [state, setState] = useState<{ signature: string; plan: DayPlan | null; error: string | null }>({ signature: "", plan: null, error: null });

  useEffect(() => {
    if (!signature) return;
    const controller = new AbortController();
    fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: signature, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("plan failed");
        return (await res.json()) as DayPlan;
      })
      .then((plan) => setState({ signature, plan, error: null }))
      .catch(() => {
        if (!controller.signal.aborted) setState((s) => ({ ...s, signature, error: "Couldn't update the draft day." }));
      });
    return () => controller.abort();
  }, [signature]);

  return {
    plan: signature ? state.plan : null,
    updating: signature !== "" && signature !== state.signature,
    error: signature ? state.error : null,
  };
}
```

- [ ] **Step 2: Create the draft-day list**

`src/components/trip/DraftDay.tsx`:

```tsx
import { CROWD_COLOR, CROWD_LABEL, LEG_VERB } from "@/lib/plan/display";
import { clock, duration } from "@/lib/plan/time";
import type { DayPlan } from "@/lib/plan/types";

export function DraftDay({ plan, updating, error, locked }: { plan: DayPlan | null; updating: boolean; error: string | null; locked: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4" aria-busy={updating}>
      <h2 className="text-sm font-semibold">{locked ? "Final day" : "Draft day"}</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {locked ? "Locked. Open it in the planner to fine-tune, save or export." : updating ? "Updating…" : "Updates as votes change."}
      </p>
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      {!plan ? (
        <p className="text-sm text-muted-foreground">Vote for a place to start the day.</p>
      ) : (
        <ol className="flex flex-col">
          {plan.stops.map((s) => (
            <li key={s.key} className="grid grid-cols-[4.5rem_1fr] gap-2">
              <span className="pt-0.5 text-sm font-semibold tabular-nums">{clock(s.startMin)}</span>
              <div className="border-l-2 border-brand pb-3 pl-3">
                {s.leg && (
                  <p className="text-xs text-muted-foreground">
                    {duration(s.leg.minutes)} {LEG_VERB[s.leg.mode]}
                  </p>
                )}
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {duration(s.endMin - s.startMin)}
                  {s.crowd && (
                    <>
                      {" · "}
                      <span style={{ color: CROWD_COLOR[s.crowd.band] }} className="font-semibold">
                        {CROWD_LABEL[s.crowd.band]}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {plan && plan.skipped.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Left out: {plan.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire the draft day and lock into TripView**

In `src/components/trip/TripView.tsx`, add these imports:

```tsx
import { DraftDay } from "./DraftDay";
import { useDraftPlan } from "./useDraftPlan";
```

Next to the other `useState` calls, add:

```tsx
const [confirming, setConfirming] = useState(false);
```

Right after the `const locked = !!trip?.lockedCode;` line, add:

```tsx
const draft = useDraftPlan(trip);
const isOrganizer = !!identity?.organizerKey && memberId === trip?.organizerId;
```

At the end of the returned JSX, replace the final two closing lines (`      </section>` followed by `    </main>`) with:

```tsx
      </section>

      <section className="flex flex-col gap-4">
        {locked && (
          <div className="rounded-xl border border-brand/35 bg-brand-soft p-4 text-sm">
            <p>
              <strong className="text-brand">Locked by {organizer}.</strong> This is the final day.
            </p>
            <Link
              href={`/plan?plan=${trip.lockedCode}`}
              className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              Open in planner →
            </Link>
          </div>
        )}
        <DraftDay plan={draft.plan} updating={draft.updating} error={draft.error} locked={locked} />
        {isOrganizer && !locked &&
          (confirming ? (
            <div className="rounded-xl border border-destructive/50 bg-card p-4">
              <p className="mb-3 text-sm">
                <strong>Lock the plan?</strong> Friends can&apos;t vote after this.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setConfirming(false);
                    act(() => tripApi<Trip>(`/${id}/lock`, { organizerKey: identity?.organizerKey }));
                  }}
                >
                  Lock plan
                </Button>
                <Button variant="outline" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button className="w-full" onClick={() => setConfirming(true)} disabled={!draft.plan}>
              Lock plan
            </Button>
          ))}
      </section>
    </main>
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/components/trip`
Expected: no errors.

- [ ] **Step 5: Verify in two browsers**

With `npm run dev` running, set up the trip as in Task 6, Step 5. Then:
1. The draft day shows the Met and Central Park with times, travel and crowd labels.
2. In the private window, suggest Brooklyn Bridge walk. Within about 4 seconds, both windows show it in the draft day.
3. In the dev server log, `POST /api/plan` appears once per real change, not every 4 seconds.
4. In the organizer window, press **Lock plan**, then **Lock plan** again in the confirmation. Both windows show "Locked by Khyati" and the vote buttons become disabled.
5. **Open in planner →** opens `/plan?plan=…` with the same stops.
6. The private window never shows a Lock button.

- [ ] **Step 6: Commit**

```bash
git add src/components/trip
git commit -m "Show the group's draft day and let the organizer lock it"
```

---

### Task 8: "Plan with friends" entry point in the planner

**Files:**
- Modify: `src/components/plan/Itinerary.tsx` (props around lines 113–148; button row around lines 199–222)
- Modify: `src/components/plan/PlannerView.tsx` (the `<Itinerary` props around line 835–845)

**Interfaces:**
- Consumes: `planCode` in `PlannerView` (already exists at line ~659)
- Produces: an optional prop `friendsHref?: string` on `Itinerary`

- [ ] **Step 1: Add the prop and link to Itinerary**

In `src/components/plan/Itinerary.tsx`:

1. Add `Users` to the existing `lucide-react` import list.
2. Add `friendsHref,` to the destructured props, after `onCalendar,`.
3. Add this to the props type, after `onCalendar: () => void;`:

```ts
  /** Starts a group trip from this plan; omitted when there's no plan to share. */
  friendsHref?: string;
```

4. Directly after the **Copy link** `</Button>` (around line 209), insert:

```tsx
        {friendsHref && (
          <a
            href={friendsHref}
            className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-background px-2.5 text-[0.8rem] font-medium transition hover:bg-muted"
          >
            <Users className="size-3.5" aria-hidden /> Plan with friends
          </a>
        )}
```

- [ ] **Step 2: Pass it from PlannerView**

In `src/components/plan/PlannerView.tsx`, in the `<Itinerary` element (around line 844), add after `onShare={sharePlan}`:

```tsx
                friendsHref={planCode ? `/trip/start?plan=${planCode}` : undefined}
```

- [ ] **Step 3: Type-check, lint, and run the whole test suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no type or lint errors, and all tests pass (the existing tests plus the 28 new ones).

- [ ] **Step 4: Verify the full flow in the browser**

With `npm run dev` running:
1. On `/plan`, build a day. **Plan with friends** appears next to **Copy link**.
2. Click it. You land on `/trip/start?plan=…`, then enter a name and start the trip.
3. You arrive on `/trip/<id>` as the organizer, with the Lock button visible.

- [ ] **Step 5: Commit**

```bash
git add src/components/plan/Itinerary.tsx src/components/plan/PlannerView.tsx
git commit -m "Add Plan with friends link to the itinerary"
```

---

### Task 9: MongoDB Atlas backend, deployment and docs

**Files:**
- Create: `src/lib/mongo.ts`
- Create: `src/lib/trip/mongo.ts`
- Test: `src/lib/trip/mongo.test.ts` (skipped unless `MONGODB_URI` is set)
- Modify: `src/lib/trip/store.ts`
- Modify: `.env.example`, `.env.local` (you fill in the value), `package.json`, `package-lock.json`
- Modify: `README.md`, `docs/architecture.md`

**Interfaces:**
- Consumes: `TripBackend`, `TripMeta`, `CandidateRecord`, `TRIP_TTL_SECONDS`, `createTripService`, `memoryBackend`
- Produces:
  - `getDb(): Promise<Db>`, the shared, cached connection (Atlas Search will reuse it later)
  - `interface TripDoc { _id: string; meta: TripMeta; members: Record<string, string>; candidates: (CandidateRecord & { votes: string[] })[]; expiresAt: Date }`
  - `mongoBackend(db: () => Promise<Db>): TripBackend`
  - `getTripStore()` now uses MongoDB whenever `MONGODB_URI` is set

**Document shape (collection `trips`):**

```json
{
  "_id": "Xy7_k2Lp9Q",
  "meta": { "id": "Xy7_k2Lp9Q", "title": "Saturday in NYC", "createdAt": 1790000000000, "organizerId": "m_abc123def456",
            "organizerKeyHash": "…sha256…", "settings": { "date": "2026-10-03", "…": "…" }, "lockedCode": null },
  "members": { "m_abc123def456": "Khyati", "Qe9…": "Rishi" },
  "candidates": [
    { "stop": { "key": "met", "name": "The Met", "…": "…" }, "addedBy": "m_abc123def456", "addedAt": 1790000000000, "votes": ["m_abc123def456", "Qe9…"] }
  ],
  "expiresAt": { "$date": "2026-11-02T00:00:00Z" }
}
```

Member IDs are base64url (`A–Z a–z 0–9 _ -`), so they're safe to use as field names under `members`. Every write is one `updateOne` with an atomic operator, so two people acting at once can't overwrite each other:

| Action | Update |
|---|---|
| Add member | `$set: { "members.<id>": name }` |
| Add candidate | filter `"candidates.stop.key": { $ne: key }` + `$push`: nothing is added if the key already exists |
| Vote / remove vote | filter `"candidates.stop.key": key` + `$addToSet` / `$pull` on `"candidates.$.votes"` |
| Keep alive | `$set: { expiresAt: now + 30 days }`; a TTL index (`expireAfterSeconds: 0`) deletes old trips |

- [ ] **Step 1: Manual setup (you do this). Create the free Atlas cluster**

Do this in your browser, not the terminal:

1. Go to https://www.mongodb.com/cloud/atlas/register and sign up. A Google login works.
2. **Create a cluster** → choose **M0 (Free)**. Provider **AWS**, region **N. Virginia (us-east-1)** (closest to NYC and to Vercel's default region). Name it `roam`. Click **Create Deployment**.
3. In the **Connect** dialog that pops up, create a **database user**: username `roam-app` and an auto-generated password. **Copy the password somewhere safe**; you can't see it again.
4. In the left sidebar, go to **Security → Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`) → Confirm. Vercel's servers don't have fixed IP addresses, so this is required for the deployed app. The database password is what protects it.
5. Go to **Database → Connect → Drivers**, choose **Node.js**, and copy the connection string. It looks like `mongodb+srv://roam-app:<db_password>@roam.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=roam`.
6. Replace `<db_password>` with the password from step 3. If the password contains `@ : / ? # [ ]` or `%`, URL-encode those characters, or generate a new password without them.
7. Open `.env.local` in the project root and add a line: `MONGODB_URI=<the full string>` (no quotes).
8. Tell Claude "Atlas is set up". Claude then checks that the value is in the file (without printing it) and continues.

- [ ] **Step 2: Install the driver**

Run: `npm install mongodb`
Expected: `mongodb` appears under `dependencies` in `package.json`.

- [ ] **Step 3: Create the shared connection**

`src/lib/mongo.ts`:

```ts
import { MongoClient, type Db } from "mongodb";

const g = globalThis as typeof globalThis & { __roamMongo?: Promise<MongoClient> };

export function hasMongo(): boolean {
  return !!process.env.MONGODB_URI;
}

/** One pooled client per server process; dev hot reloads and warm serverless calls reuse it. */
export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");
  g.__roamMongo ??= new MongoClient(uri, { appName: "roam-nyc", maxPoolSize: 5 }).connect().catch((error: unknown) => {
    g.__roamMongo = undefined;
    throw error;
  });
  return (await g.__roamMongo).db(process.env.MONGODB_DB || "roam");
}
```

- [ ] **Step 4: Write the MongoDB test (runs only with `MONGODB_URI`)**

`src/lib/trip/mongo.test.ts`:

```ts
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
  });
});
```

Suggesting the bridge twice checks that the duplicate-key filter stops the second `$push`.

- [ ] **Step 5: Run it and confirm it fails**

Run: `npx vitest run src/lib/trip/mongo.test.ts` (Vitest doesn't read `.env.local`, so pass the URI explicitly):

```bash
MONGODB_URI="$(grep '^MONGODB_URI=' .env.local | cut -d= -f2-)" npx vitest run src/lib/trip/mongo.test.ts
```

Expected: FAIL, "Failed to resolve import "./mongo"".

- [ ] **Step 6: Implement the MongoDB backend**

`src/lib/trip/mongo.ts`:

```ts
import type { Collection, Db } from "mongodb";
import { TRIP_TTL_SECONDS, type CandidateRecord, type TripBackend, type TripMeta } from "./backend";

export interface TripDoc {
  _id: string;
  meta: TripMeta;
  members: Record<string, string>;
  candidates: (CandidateRecord & { votes: string[] })[];
  expiresAt: Date;
}

const expiry = () => new Date(Date.now() + TRIP_TTL_SECONDS * 1000);

export function mongoBackend(db: () => Promise<Db>): TripBackend {
  let ready: Promise<Collection<TripDoc>> | null = null;
  const trips = () =>
    (ready ??= db()
      .then(async (d) => {
        const col = d.collection<TripDoc>("trips");
        await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        return col;
      })
      .catch((error: unknown) => {
        ready = null;
        throw error;
      }));
  const load = async (id: string) => (await trips()).findOne({ _id: id });

  return {
    async getMeta(id) {
      return (await load(id))?.meta ?? null;
    },
    async setMeta(meta) {
      await (await trips()).updateOne(
        { _id: meta.id },
        { $set: { meta, expiresAt: expiry() }, $setOnInsert: { members: {}, candidates: [] } },
        { upsert: true },
      );
    },
    async getMembers(id) {
      return (await load(id))?.members ?? {};
    },
    async setMember(id, memberId, name) {
      await (await trips()).updateOne({ _id: id }, { $set: { [`members.${memberId}`]: name, expiresAt: expiry() } });
    },
    async getCandidates(id) {
      const doc = await load(id);
      return Object.fromEntries((doc?.candidates ?? []).map(({ stop, addedBy, addedAt }) => [stop.key, { stop, addedBy, addedAt }]));
    },
    async addCandidate(id, record) {
      const result = await (await trips()).updateOne(
        { _id: id, "candidates.stop.key": { $ne: record.stop.key } },
        { $push: { candidates: { ...record, votes: [] } }, $set: { expiresAt: expiry() } },
      );
      return result.modifiedCount === 1;
    },
    async getVotes(id, stopKeys) {
      const doc = await load(id);
      const byKey = new Map((doc?.candidates ?? []).map((c) => [c.stop.key, c.votes]));
      return Object.fromEntries(stopKeys.map((key) => [key, byKey.get(key) ?? []]));
    },
    async setVote(id, stopKey, memberId, on) {
      const filter = { _id: id, "candidates.stop.key": stopKey };
      await (await trips()).updateOne(
        filter,
        on ? { $addToSet: { "candidates.$.votes": memberId } } : { $pull: { "candidates.$.votes": memberId } },
      );
    },
    async touch(id) {
      await (await trips()).updateOne({ _id: id }, { $set: { expiresAt: expiry() } });
    },
  };
}
```

- [ ] **Step 7: Run the test and confirm it passes**

Run:

```bash
MONGODB_URI="$(grep '^MONGODB_URI=' .env.local | cut -d= -f2-)" npx vitest run src/lib/trip/mongo.test.ts
```

Expected: PASS, 1 test. If it times out, check Network Access (Step 1.4) and the password encoding (Step 1.6).

- [ ] **Step 8: Use MongoDB in the store when `MONGODB_URI` is set**

Replace `src/lib/trip/store.ts` with:

```ts
import { getDb, hasMongo } from "@/lib/mongo";
import { memoryBackend } from "./memory";
import { mongoBackend } from "./mongo";
import { createTripService, type TripService } from "./service";

let service: TripService | null = null;

export function getTripStore(): TripService {
  if (service) return service;
  if (hasMongo()) {
    service = createTripService(mongoBackend(getDb));
  } else {
    if (process.env.NODE_ENV === "production") console.warn("[trips] MONGODB_URI is not set: trips live in memory and vanish on restart.");
    service = createTripService(memoryBackend());
  }
  return service;
}
```

- [ ] **Step 9: Document the env vars**

Append to `.env.example`:

```bash

# Stores "Plan with friends" group trips in MongoDB Atlas (free M0 cluster is plenty).
# Atlas → Database → Connect → Drivers → Node.js, then paste the string with your
# password filled in. Without it, trips live in the dev server's memory and vanish on restart.
MONGODB_URI=
# Optional. Database name; defaults to "roam".
MONGODB_DB=
```

- [ ] **Step 10: Run the full suite, and check the app against Atlas**

Run: `npm test`
Expected: all tests pass. The MongoDB test is reported as skipped, because `npm test` doesn't pass the URI.

Then restart `npm run dev`, which loads `.env.local`, and repeat the Task 7 two-browser check. In Atlas, open **Database → Browse Collections → roam → trips**. The trip should be there as one document, and its `votes` arrays should change as you vote.

- [ ] **Step 11: Update the docs**

In `docs/architecture.md`, add these rows to the **API routes** table:

```markdown
| `POST /api/trips` | Start a group trip from a plan code |
| `GET /api/trips/[id]` | Group trip state (members, places, votes, lock) |
| `POST /api/trips/[id]/join`, `/candidates`, `/vote`, `/lock` | Join, suggest a place, vote, organizer lock |
```

Add these rows to the **Code map** table:

```markdown
| `src/lib/trip/`, `src/components/trip/` | Plan with friends: group voting, storage, trip page |
| `src/lib/mongo.ts` | Shared MongoDB Atlas connection |
```

Add this row to the **Data sources** table:

```markdown
| MongoDB Atlas | Group trip storage for Plan with friends (one document per trip, 30-day TTL) |
```

In `README.md`, under **Run locally**, add after the sentence about API keys:

```markdown
`MONGODB_URI` (MongoDB Atlas) stores "Plan with friends" group trips; without it trips live in the dev server's memory.
```

- [ ] **Step 12: Commit**

```bash
git add src/lib/mongo.ts src/lib/trip/mongo.ts src/lib/trip/mongo.test.ts src/lib/trip/store.ts .env.example package.json package-lock.json README.md docs/architecture.md
git commit -m "Store group trips in MongoDB Atlas and document setup"
```

`.env.local` is gitignored and must never be committed. It contains the database password.

- [ ] **Step 13: Manual setup (you do this). Deploy to Vercel with the database**

1. Push the branch: `git push`.
2. In Vercel, open the project, then go to **Settings → Environment Variables** and add `MONGODB_URI` with the same value as in `.env.local`, for **Preview** and **Production**. You can also use Vercel's **Marketplace → MongoDB Atlas** integration, which sets `MONGODB_URI` for you.
3. Also add `GEMINI_API_KEY` and `GOOGLE_PLACES_API_KEY` there if they aren't set yet.
4. Redeploy the `khyati` preview, then run the two-device check (laptop and phone) on the preview URL.
5. Expected: votes appear on the other device within about 4 seconds, and the trip is still there after a redeploy.

---

## Later: Atlas Search for Discover (not part of this plan)

Once group trips work, the next MongoDB step is a separate spec and plan:
- Load `src/lib/discover/poi-data.json` (about 29.6k places) into a `places` collection on the same cluster through `getDb()`.
- Create an Atlas Search index (name with autocomplete, category, a geo point).
- Replace the Discover local search in `src/lib/discover/sources.ts` with an `$search` aggregation, and keep the bundled JSON as a fallback.

Nothing in this plan needs to change for that. It only adds a collection and uses the same connection helper.
