# Trip Room: group trip planning, v2

Status: approved design (2026-09-26). It replaces the "organizer locks" model in `2026-09-26-group-trip-voting-design.md`.
Owner: Khyati (branch `khyati`)

## Summary

The trip room is where a group decides a NYC day together. Friends join from an invite link with a name and an emoji avatar. They drop a rough starting point, suggest places, post ideas, upvote, and tap **I'm in**. When everyone is in, the plan locks. Roam's existing optimizer schedules the day. The room adds three things on top of it: a **fair first stop** (nobody travels too long to get there), an optional **meetup station**, and **getting home** (each person's options after the last stop, with time and rough cost).

The room also serves as Roam's front door for groups. A new user first answers **"Who's coming?"**. Solo and couple users go to the normal planner, and groups get a trip room.

## Goals

- Group decisions: no single person locks the plan.
- One entry point for every new user ("Who's coming?"), which routes to the right path.
- A dashboard-style room: Places and Ideas on the left, map, draft day and getting home on the right, and the "I'm in" bar along the bottom. On phones it uses tabs.
- The feature is self-contained so it merges cleanly with teammates' work. It is ready for a colleague's upcoming login without depending on it.
- The frontend can be redesigned later without touching any logic.

## Non-goals

- Live connections (WebSockets). Polling every 3–4 s is enough and works on Vercel.
- Live transit data. All times and costs are estimates and are labelled as such.
- Atlas Search for the place picker. That's a separate project that reuses `getDb()`.

## Architecture: one self-contained feature folder

```text
src/features/plan-with-friends/
  core/        plain logic, no React or Next: ranking, consensus, fairness, getting home, avatars
  server/      backends (memory, MongoDB), service rules, request schemas, route handlers
  ui/          React components and the useTripRoom() hook
  bridge.ts    the ONLY file that imports app code outside this folder
  identity.ts  who the viewer is: guest today, the colleague's login later
  index.ts     public entry point (TripRoomPage, StartPage, WhoIsComing, …)
src/app/start, src/app/trip/**, src/app/api/trips/**   one-line re-exports into the feature
```

- An ESLint rule (`no-restricted-imports`) blocks `@/lib/*` and `@/components/*` imports anywhere in the feature except `bridge.ts`. That keeps the boundary enforced, not just a convention.
- The rest of the app touches the feature in exactly three places: the one-line route files, the **Plan with friends** link in `Itinerary.tsx`, and one link on the landing page.
- `src/lib/mongo.ts` stays shared, because Atlas Search will use it too.
- The UI only reads from `useTripRoom(id)`, which returns `{ trip, me, draft, status, actions }`. A future redesign can replace every file in `ui/` and keep the hook.
- Styling uses the app's theme tokens (`bg-card`, `text-brand`, …), so it follows teammates' theme changes and dark mode.

## Identity (ready for login, works without it)

```ts
export interface SessionUser { userId: string; name: string; photoUrl: string | null }
export interface IdentityProvider {
  current(request: Request): Promise<SessionUser | null>;   // server
  loginUrl(returnTo: string): string | null;                 // client
}
```

- **Today:** `guestIdentity` returns `null` and `loginUrl` returns `null`. People join with a name and an emoji, and their member ID is saved in the browser, as in v1.
- **Later:** the colleague implements `IdentityProvider` in one file.
  - When `loginUrl` returns a URL, invite links send people through login and back to the trip.
  - When `current()` returns a user, their member ID becomes `u_<userId>`, the same on every device. The server takes the member ID from the session instead of the request body, and the user's name and photo replace the typed name and emoji.

## Data model changes

`members` changes from `Record<id, string>` to `Record<id, Member>`:

```ts
interface Avatar { emoji: string; color: AvatarColor }          // both from fixed lists
interface Member { name: string; avatar: Avatar; joinedAt: number }
```

Old trips that stored a plain name string still read correctly: they get a default avatar.

The trip metadata gains:
- `deadline: number | null`: after this time, a majority is enough to lock.
- `hostId` (renamed from `organizerId`): the person who created the room. It's shown as "host" and grants no special powers.

The organizer key and the `/lock` route are removed.

Confirmations are stored per member as `confirmations.<memberId> = draftSignature`, where `draftSignature` is a SHA-256 hash of the current draft request. A confirmation counts only when it matches the **current** signature. So when the draft changes, everyone's confirmation stops counting automatically, and no reset write is needed.

## Deciding together

- `POST /api/trips/[id]/confirm { memberId, on }` saves or clears that member's confirmation of the current draft.
- **Lock rule**, checked after every confirmation and on every read:
  - every member has confirmed the current draft, **or**
  - the deadline has passed and more than half the members have confirmed it.

  When the rule is met, the server stores `lockedCode = encodePlan(draft)`. After that, every change except viewing is refused with 409.
- `POST /api/trips/[id]/deadline { memberId, at | null }`: any member can set or clear the deadline.
- There's no way to lock without a draft. The **I'm in** button is disabled when no place has a vote.

## "Who's coming?" entry

- `WhoIsComing` is a standalone component, and `/start` is its page. The landing page links there, and the colleague's landing redesign can embed the component directly.
- Cards and where they lead:
  - **Just me** → `/plan`, with the profile group set to `solo`.
  - **Two of us** → `/plan`, with the group set to `couple`.
  - **Family** → a choice: plan it myself, or plan together.
  - **Friends** and **Work team** → start a trip room.
- Starting a room from here asks for your name, an emoji, a color and the date. It creates an **empty** room, with default day settings of 10:00–21:00 by transit and "avoid crowds". Starting from the itinerary's **Plan with friends** link seeds the room with that plan, as in v1.

## Phases

Each phase gets its own implementation plan and works on its own.

1. **P1: Foundation and deciding together.**
   - The feature folder and the ESLint boundary.
   - Identity adapter.
   - "Who's coming?" and `/start`.
   - Avatars.
   - Confirmations, deadline and automatic lock.
   - Dashboard layout: header with avatar stack; Places; Draft day; "I'm in" bar; phone tabs.
   - An empty map card that says "Add where you're starting from" is **not** shown until P2.
2. **P2: Map and fair start.**
   - Each member sets a starting point: search a neighborhood or station, rounded to about 200 m, and only the area label is shown to others.
   - Map panel with avatar pins and each person's line to the fair first stop.
   - **Fair first stop:** `legMatrix` gives the time from every start to every stop in the day. The server picks the stop with the smallest worst-case time (ties go to the smallest total) and passes it to the planner as the starting point, so the optimizer is unchanged.
   - **Meetup suggestion:** the subway station with the smallest worst-case time, from the 407 station complexes in `crowd-data.json`. It appears as a special place people vote on.
3. **P3: Getting home.**
   - From the last stop to each member's start, by subway, e-bike, taxi and walking, using `legMatrix` and `subwayLeg`.
   - Rough costs from published NYC fares: subway, Citi Bike e-bike and yellow taxi. The values are checked before being hard-coded and are shown as "~".
   - A late-night extra wait for subway trips, which triggers a "leave by …" warning.
   - The best option for each person is highlighted.
4. **P4: Ideas and chat.**
   - A `trip_ideas` collection holding `{ tripId, memberId, text, votes[], placeKey | null, at }`.
   - Posting, upvoting and "turn into a place" (the place search opens with the text filled in and links the result back to the idea).
   - Loaded with the regular polling, capped at the latest 100.
5. **P5: Availability.**
   - Members optionally set when they're free, e.g. "free 2–11pm".
   - The day uses the time everyone shares. If there is none, it uses the time most people share and marks who misses which stop.

## Added after P1 (from review)

- **P1.5: Place search.** As-you-type search over Roam's catalog plus the ~30k bundled OSM places, via `GET /api/trips/places?q=`.
  - Each result shows its kind and address, or the nearest subway station when there's no address.
  - A chosen place keeps its opening hours.
  - "Search the map" remains as a fallback.
  - P2's "Where are you starting from?" reuses the same component.
- **P1.6: Remove, photos, Ask Roam.**
  - **Remove:** the person who suggested a place can remove it (`POST /api/trips/[id]/remove`), and must confirm when others have voted for it. Everyone else can only take back their own vote.
  - **Photos:** every place and draft-day stop shows a photo from the app's `/api/photo`. That's Roam's own photos for catalog sights, and Google Places within its quota caps for everything else.
  - **Ask Roam:** the landing page's "describe your day" box, inside the room. `/api/assistant` (Gemini) turns a sentence into places, which are added as that member's suggestions. Its "pick one" options for vague wishes can be tapped to add them.

## Error handling (all phases)

Everything from v1 still applies. New cases:

| Situation | Behaviour |
|---|---|
| A confirmation is for an out-of-date draft | It isn't counted, and the UI shows "The day changed. Tap I'm in again." |
| The deadline passed without a majority | The trip stays open, and the bar says "Deadline passed. Waiting for a majority." |
| No stops yet | The "I'm in" button is disabled: "Vote for a place first." |
| A starting point is outside NYC (P2) | 400: "Pick a starting point in New York City." |
| Routing is unavailable (P2/P3) | Fall back to the planner's straight-line estimates, marked "estimate". |

## Testing

- **Unit tests** in `core/`: consensus (unanimous, out-of-date confirmations, deadline plus majority), avatar validation, and later fairness and getting-home costs.
- **Service tests** on the memory backend, plus the existing live MongoDB test extended to cover confirmations.
- **HTTP test** for the routes. Organizer-lock tests are replaced by confirm and deadline tests.
- **Two-browser test** per phase, on laptop and phone widths, before each phase is committed.
