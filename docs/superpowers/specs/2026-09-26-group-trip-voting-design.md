# Plan with Friends: group trip voting

Status: design, awaiting team review
Owner: Khyati (branch `khyati`)
Date: 2026-09-26

## Summary

A group plans one NYC day together. The organizer starts a trip and shares a link. Friends open it, enter a name, suggest places and vote on each other's picks. Everyone sees a draft day built from the top-voted stops, and the draft updates as votes come in. When the group is ready, the organizer locks the plan. That produces a normal Roam plan link, which opens in the existing planner for fine-tuning, sharing and calendar export.

Why it fits Roam: the product's strength is turning a set of stops into a realistic, timed day. Group voting decides which stops go in, and the existing optimizer decides the order and timing. The optimizer itself doesn't change.

## Goals

- Several people contribute to one trip from their own phones, with no accounts.
- Votes decide which stops go in, and the optimizer schedules them.
- The organizer has the final say and presses Lock.
- Works when deployed on Vercel, and also with plain `npm run dev` without setting up any services.
- Changes to existing code are minimal: `PlannerView.tsx` gets one button.

## Non-goals

- Live co-editing of an itinerary, or changes showing up instantly. Pages check for updates every 4 seconds.
- Accounts, logins or permissions beyond the organizer key.
- Multi-day trips, chat or comments.
- Protection against someone voting as several people. Anyone with the link can vote, and that's acceptable for a demo.

## User flow

1. **Start.** In the planner, the organizer presses **Plan with friends** next to Share. The app creates a trip from the current stops and settings (date, times, mode, crowd preference, origin, profile, meals). Each current stop becomes a candidate with the organizer's vote on it. The browser goes to `/trip/{id}`.
2. **Invite.** The organizer copies the trip link, using the same clipboard method as Share.
3. **Join.** A friend opens the link and enters a display name, which is remembered in their browser.
4. **Suggest and vote.** Anyone can add a place. Adding one also counts as a vote from the person who added it. Anyone can vote for or remove their vote from any candidate. The candidate list is sorted by vote count.
5. **Draft day.** The page shows a compact draft itinerary (arrival times, travel between stops, crowd level) built from the top 10 candidates.
6. **Lock.** Only the organizer sees **Lock plan**. Locking freezes the trip. Everyone then sees the final day and an **Open in planner** link, `/plan?plan={code}`.

## Architecture

```text
/plan (PlannerView) ──"Plan with friends"──▶ POST /api/trips ──▶ /trip/[id]
                                                                     │
/trip/[id] (TripView) ── polls GET /api/trips/[id] every 4 seconds ◀─┤
        │  join / add candidate / vote / lock (POST /api/trips/[id]/*)
        │
        └── topStops(trip) changed? ──▶ POST /api/plan (existing) ──▶ draft DayPlan
```

The trip page is separate from the planner. `PlannerView.tsx` is about 60 KB and the whole team edits it, so keeping the new feature in its own files avoids merge conflicts.

### New files

| Path | Purpose |
|---|---|
| `src/lib/trip/types.ts` | `Trip`, `Candidate`, `Member` types |
| `src/lib/trip/rank.ts` | `topStops(trip)`: the 10 most-voted stops, ties broken by who added first |
| `src/lib/trip/store.ts` | `TripStore` interface, plus `redisStore` (Upstash) and `memoryStore` (dev) |
| `src/lib/trip/schema.ts` | Zod schemas for request bodies (reuses `StopSchema`, `PlanRequestSchema`) |
| `src/app/api/trips/route.ts` | `POST`: create trip |
| `src/app/api/trips/[id]/route.ts` | `GET`: trip state |
| `src/app/api/trips/[id]/join/route.ts` | `POST`: add member |
| `src/app/api/trips/[id]/candidates/route.ts` | `POST`: add candidate |
| `src/app/api/trips/[id]/vote/route.ts` | `POST`: vote or remove vote |
| `src/app/api/trips/[id]/lock/route.ts` | `POST`: lock (organizer only) |
| `src/app/trip/[id]/page.tsx` | Server page; reads `params` and renders `TripView` |
| `src/components/trip/TripView.tsx` | Client UI: join, candidate list, draft day, lock |

### Changed files

| Path | Change |
|---|---|
| `src/components/plan/PlannerView.tsx` | One **Plan with friends** button and its handler, next to Share |
| `.env.example` | Documents `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` |
| `package.json` | Adds `@upstash/redis` |

The optimizer, `/api/plan`, `share.ts` and the other planner components don't change.

## Data model

```ts
interface TripSettings {           // PlanRequest without stops/keepOrder
  date: string; startMin: number; endMin: number;
  mode: TravelMode; crowd: CrowdPref;
  origin: { label: string; lat: number; lon: number } | null;
  returnToOrigin: boolean; profile: Profile; meals: { lunch: boolean; dinner: boolean };
}

interface Candidate {
  stop: StopInput;                 // same shape the planner already uses
  addedBy: string;                 // member id
  addedAt: number;                 // ms, tie-breaker
  votes: string[];                 // member ids
}

interface Trip {
  id: string;                      // 10-char URL-safe random id
  title: string;                   // e.g. "Saturday in NYC"
  createdAt: number;
  settings: TripSettings;
  members: Record<string, string>; // member id -> display name
  candidates: Candidate[];
  lockedCode: string | null;       // encodePlan() output once locked
}
```

The organizer key is never returned by the API. The server stores only its SHA-256 hash.

### Redis layout (Upstash)

Using one key per piece of state means two people acting at the same moment never overwrite each other, so no locking is needed.

| Key | Type | Contents |
|---|---|---|
| `trip:{id}` | string (JSON) | title, createdAt, settings, organizerKeyHash, lockedCode |
| `trip:{id}:members` | hash | member id → display name |
| `trip:{id}:cands` | hash | stop key → JSON `{ stop, addedBy, addedAt }` |
| `trip:{id}:votes:{stopKey}` | set | member ids |

- Adding and removing votes uses `SADD` / `SREM`, which Redis applies as single steps.
- Each write refreshes a 30-day expiry on all of the trip's keys.
- `GET` reads the meta, both hashes and every vote set in one pipeline.

### Store selection

`store.ts` exports `getTripStore()`:

- It uses `redisStore` when both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set. It also accepts `KV_REST_API_URL` and `KV_REST_API_TOKEN`, the names Vercel's Upstash integration sets.
- Otherwise it uses `memoryStore`, a `Map` held in memory. That works for `npm run dev`, but trips disappear when the server restarts. In production without credentials, the server logs a warning.

## API

All bodies are validated with Zod. Every error returns `{ error: string }`, the same format as `/api/plan`.

| Route | Body | Returns | Rules |
|---|---|---|---|
| `POST /api/trips` | `{ title?, settings, stops: StopInput[] (0–10), name }` | `{ id, memberId, organizerKey }` | The creator becomes the first member and votes for every seed stop |
| `GET /api/trips/[id]` | none | `Trip` | 404 if missing or expired |
| `POST /api/trips/[id]/join` | `{ name }` (1–30 chars) | `{ memberId }` | |
| `POST /api/trips/[id]/candidates` | `{ memberId, stop }` | `Trip` | The member must exist. If the stop key is already a candidate, adding it counts as a vote instead. At most 30 candidates |
| `POST /api/trips/[id]/vote` | `{ memberId, stopKey, on: boolean }` | `Trip` | The member and candidate must exist |
| `POST /api/trips/[id]/lock` | `{ organizerKey, code }` | `Trip` | The key hash must match. `code` must decode with `decodePlan` |

After a lock, `join`, `candidates` and `vote` return 409 with the message "This plan is locked."

Route handlers read params as a Promise in this Next.js version: `export async function GET(req: Request, ctx: RouteContext<"/api/trips/[id]">) { const { id } = await ctx.params; }`. Page components do the same. See `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.

## Draft-day logic

`topStops(trip)`:
- Sorts candidates by vote count (most first), then by `addedAt` (earliest first).
- Keeps the first 10, because the optimizer accepts at most 10 stops.
- Drops candidates with 0 votes.

`TripView` builds a `PlanRequest` from `trip.settings` plus `topStops(trip)`, then calls the existing `POST /api/plan`. The result is cached by the ordered list of stop keys. Polling only triggers a new plan request when the top-10 set or its order actually changes, so it never calls the optimizer every 4 seconds.

Candidates ranked 11th and below, and those with 0 votes, are listed under a "Not in the day yet" heading.

## Screen layout (`/trip/[id]`)

Mobile first, one column. On wide screens: candidates on the left, draft day on the right.

1. **Header:** trip title, date, member names as chips, and a **Copy invite link** button.
2. **Join card** (only if this browser hasn't joined): a name input and a Join button. Until someone joins, the page is view-only.
3. **Candidates:** each row has the place name, "added by {name}", the vote count, and a vote toggle (filled when you've voted). An **Add a place** button opens the existing `StopPicker` (catalog plus search).
4. **Draft day:** a compact list built from the `DayPlan`: arrival time, stop name, travel time from the previous stop, crowd label. A note says "Updates as votes change." It doesn't reuse `Itinerary.tsx`, because that component needs about 15 planner-specific props (save, calendar, photos, forecast).
5. **Organizer bar** (organizer only): **Lock plan**. Before locking, a confirmation built into the page asks "Lock the plan? Friends can't vote after this." The viewer blocks `confirm()`, so the confirmation can't use it.
6. **Locked state:** the vote controls disappear, a "Locked by {organizer}" banner appears, and an **Open in planner** button links to `/plan?plan={lockedCode}`.

Tailwind classes and the `ui/` components (`button`, `card`, `badge`, `input`) match the existing look.

## Browser storage

- Key `roam:trip:{id}` holds `{ memberId, organizerKey? }` in `localStorage`, using the same try/catch pattern as `share.ts`.
- If storage isn't available (a private window), the member ID only lasts for the current page load. The page shows "Your vote won't be remembered on this device."

## Error handling

| Situation | Behaviour |
|---|---|
| Trip not found or expired | The page says "This trip has expired or the link is wrong" and links to `/plan` |
| A check for updates fails | Keep the last known state and show a small "Reconnecting…" note. Keep checking every 4 seconds |
| `/api/plan` fails for the draft | Keep the previous draft and show "Couldn't update the draft day." The candidate list still works |
| Draft has 0 voted stops | "Vote for a place to start the day" |
| More than 30 candidates | 400, "This trip has enough ideas. Vote on the ones already here." |
| Redis is down | 503, "Trips are unavailable right now." The existing planner is unaffected |
| The browser has a stored member ID the server doesn't know | Clear the stored ID and show the Join card again |

## Testing

These use Vitest, which the project already uses. Test files sit next to the code, like the existing `*.test.ts` files.

- `rank.test.ts`: sorting by votes, tie-breaking by `addedAt`, the cut at 10, and dropping stops with 0 votes.
- `store.test.ts`: run the same tests against `memoryStore` covering create, join, add candidate (including a duplicate key counting as a vote), voting on and off, lock with the right and wrong key, and refusing changes after a lock.
- `schema.test.ts`: rejects names that are too long, unknown `memberId` shapes, and more than 10 seed stops.
- Manual end-to-end test: two browsers (one of them private), with the organizer creating, the friend joining, votes changing the draft within about 4 seconds, locking, and opening in the planner.

The Redis store is tested by hand against a free Upstash database, not in CI.

## Setup for the team

1. `npm install @upstash/redis`
2. Local dev: nothing extra, because the memory store is used automatically.
3. Vercel: Project → Storage → add **Upstash for Redis** (free tier). Vercel adds the env vars itself. Redeploy.
4. To use Upstash locally as well, copy the two variables into `.env.local`.

## Build order

1. `types.ts`, `rank.ts` and tests
2. `store.ts` (memory store first) and tests
3. API routes and schemas
4. `/trip/[id]` page and `TripView`
5. The **Plan with friends** button in `PlannerView`
6. `redisStore` and a Vercel deploy check
7. Demo run with two phones

Steps 1–3 and step 4 can be split between two people once `types.ts` is agreed on.

## Demo script (60 seconds)

1. Type "Saturday: the Met, Central Park, pizza in the Village" and the plan appears.
2. Tap **Plan with friends** and send the link to a teammate's phone.
3. The teammate joins as "Rishi", adds the Brooklyn Bridge and votes it up.
4. On the laptop, the draft day reorders itself and the bridge fits into the evening slot.
5. Tap **Lock plan**, then **Open in planner**, and show the timed day with crowd levels.

## Open questions

- Should the organizer be able to remove a candidate? Leaving it out keeps the first version smaller. Low-voted candidates already stay out of the day.
- Should the trip title be editable? Currently it's generated from the date.
