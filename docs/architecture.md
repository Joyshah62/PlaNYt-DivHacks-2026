# PlaNYt — System Architecture

## Overview

```
Browser
├── /              Landing page (editorial 3D design)
├── /login         Authentication
├── /plan          Solo planner (map + itinerary)
├── /start         Group trip creation
└── /trip/[id]     Group trip room (voting, itinerary)

Server (Next.js API)
├── /api/auth/*              Better-auth handler
├── /api/assistant           Gemini: text → structured request
├── /api/plan                Optimize stops → timed itinerary
├── /api/plan/{compare,days,short}  Variants and multi-day
├── /api/trip-chat           Conversational plan updates
├── /api/trips/*             Group trip operations (CRUD, voting)
├── /api/discover            Find places that fit gaps
├── /api/{food,place,photo}  Place data and photos
├── /api/{resolve,route}     Geocoding and route geometry
├── /api/weather             16-day forecast
├── /api/{budget,health,alerts}  Preferences and warnings
└── /api/speech/{stt,tts}    Voice I/O

External Services
├── Google Gemini            Intent extraction, trip chat
├── OSRM (openstreetmap.de)  Walk/bike/car routing
├── Google Maps              Photos, ratings (optional)
├── Open-Meteo               Weather
├── MTA Subway Hourly Ridership (cached)  Crowd profiles
└── MongoDB Atlas (optional) Group trips, saved plans, auth
```

## Request Flows

### Solo Planning

1. User describes a day or manually adds stops → `/api/assistant` (if text) or direct stops
2. `/api/plan` optimizes:
   - Build leg matrix (OSRM + subway estimates)
   - Gather crowd profiles for each stop (MTA data)
   - Run optimizer: try all orderings, score by travel + crowds + constraints
   - Return `DayPlan` with times, legs, insights
3. Browser requests `/api/route` once per leg for map geometry
4. User adjusts via chat → `/api/trip-chat` (re-runs optimizer with context)

### Group Planning

1. Creator opens `/start` → creates MongoDB trip doc
2. Invites friends via link → they join at `/trip/[id]`
3. Members vote on stops via `/api/trips/[id]/ideas/vote`
4. PlaNYt generates candidate itineraries via `/api/trips/[id]/candidates`
5. Members approve/confirm via `/api/trips/[id]/approve` and `/api/trips/[id]/confirm`
6. Final itinerary is `/api/trips/[id]/itinerary` (optimized across all votes)

## Planning Engine

### Optimizer

For a set of stops and constraints (date, time window, mode, crowd preference, fixed-time stops, meal breaks):

1. **Skip closed stops** — any attraction without hours on the chosen weekday is set aside
2. **Build leg matrix** — OSRM for walk/bike/car; station graph + walking for subway
3. **Crowd profiles** — for each stop, sum MTA ridership from nearby stations (≤900m), distance-weighted, hourly
4. **Search** — depth-first search with branch-and-bound pruning over all permutations
   - Objective: `travel + wait + crowds*visitTime + penalties`
   - For ≤~8 stops, finds true optimum in <100ms
   - For larger, uses greedy seeding + insertion improvement within budget
5. **Insights** — human-readable explanations ("saves 22 min travel", "crowd peak at 2pm")

### Constraints

- **Fixed times:** Can't start before the set time; heavy penalty if missed
- **Meals:** Prefer lunch 11:30–1:30, dinner 6–8:30; float (no travel cost to get there)
- **Walk limit:** Swap walking for subway if leg exceeds threshold
- **Opening hours:** Avoid arriving when closed; if unavoidable, heavy penalty
- **End time:** 2× penalty per minute over the day's end

## Data Sources

| Source | Use | License |
|---|---|---|
| MTA Subway Hourly Ridership | Area foot traffic (proxy for crowds) | Public data (data.ny.gov) |
| OpenStreetMap | Map tiles, routing, geocoding, POI catalog | ODbL |
| OSRM | Street routing (walk/bike/car) | Free public API |
| Google Gemini | NL → structured intent | Paid API (capped usage) |
| Google Places | Live photos, ratings | Paid API (optional) |
| Wikipedia / Wikimedia Commons | Catalog photos with credits | CC licenses |
| Open-Meteo | Weather forecasts | Free API |
| MongoDB Atlas | Group trips, saved plans, auth state | User-configured |

## Code Organization

```
src/
├── app/
│   ├── page.tsx            Landing (HeroStage, PlanDemo, NeighborhoodStory)
│   ├── home.css            Landing styles (editorial)
│   ├── editorial.css       Fonts and typography
│   ├── plan/               Solo planner UI
│   ├── start/              Group creation form
│   ├── trip/[id]/          Group trip room
│   ├── login/              Auth page
│   ├── api/                Server endpoints
│   └── globals.css         Global styles
│
├── components/
│   ├── home/               Landing components (Hero, PlanDemo, Neighborhoods)
│   ├── editorial/          Shared editorial components (fonts, themes)
│   ├── plan/               Planner UI (map, itinerary, cards)
│   └── trip/               Group trip UI (voting, approvals, chat)
│
├── lib/
│   ├── auth.ts             Better-auth server setup
│   ├── auth-client.ts      Client auth context
│   ├── db.ts               MongoDB connection
│   ├── mongo.ts            Queries (trips, auth, saved plans)
│   ├── session.ts          Session management
│   ├── llm/gemini.ts       Gemini client + structured output
│   ├── plan/               Optimizer, crowd data, routing
│   ├── osm/                OSM clients (OSRM, Nominatim, Overpass)
│   ├── discover/           Place suggestion scoring
│   └── utils.ts            Shared utilities
│
└── features/
    └── plan-with-friends/  Group planning logic (voting, merging preferences)
```

## Tech Stack

| Layer | Stack |
|---|---|
| Runtime | Node.js 20+ (Next.js 16) |
| Frontend | React 19 + TypeScript + Tailwind CSS 4 |
| Backend | Next.js API routes (serverless-compatible) |
| Database | MongoDB (groups, saved plans) |
| Auth | better-auth (social login, phone, magic link) |
| AI | Google Gemini (structured JSON output) |
| Routing | OSRM public servers + Google Maps (fallback) |
| Maps | Google 3D maps (landing), MapLibre GL (planner) |
| Charts | Recharts (crowd bars, multi-day) |
| Icons | Lucide React |
| Voice | Spectrum.ts (iMessage), Web Speech API (browser) |
| Validation | Zod |
| Testing | Vitest |

## Performance Notes

- Optimizer scales to ~10 stops in <100ms; larger requests use heuristics
- Crowd data is pre-compiled into JSON, no runtime API calls
- Place photos cached in-process for 6 hours; local lookup counters (reset on cold start)
- Map geometry fetched once per plan; reused on edits
- Group voting aggregates in real-time; itinerary regenerates on each major vote change

## Deployment

Standard Node.js host (Vercel, Railway, Render, etc.). Required env vars:

- `BETTER_AUTH_SECRET` — random string for auth
- `MONGODB_URI` — (optional) MongoDB connection; local fallback

Optional:

- `GEMINI_API_KEY` — Google Gemini
- `GOOGLE_CLIENT_ID/SECRET` — Google OAuth
- `GOOGLE_PLACES_API_KEY` — Google Places
- `TAVILY_API_KEY` — Web search for trip chat
- `SPECTRUM_PROJECT_*` — iMessage bot keys
