# Roam NYC — System Architecture

## What Is Roam NYC?

Roam NYC is an AI-powered day-trip planner for New York City. Given a free-text description of what you want ("a chill Saturday in Brooklyn with a museum and good pizza"), it produces an optimized, timed itinerary that threads together opening hours, real street routing, and hour-by-hour crowd data derived from MTA subway ridership — so you spend time at great places, not in lines or zigzagging across the city.

---

## High-Level Architecture

```
Browser (Next.js App Router)
│
├── / (Landing Page)
│   └── Hero prompt → /plan?q=...
│
└── /plan (Planner App)
    ├── PlannerView (client component, all state)
    ├── Build view   — stop picker, AI prompt, trip settings
    └── Itinerary view — timed stops, crowd bars, choices, chat
        └── PlanMap (MapLibre GL, SSR-disabled)

Server (Next.js API Routes)
├── POST /api/assistant    — Gemini NL → structured plan request
├── POST /api/plan         — optimizer → DayPlan
├── POST /api/plan/compare — compare options (choices panel)
├── GET  /api/plan/days    — multi-day overview
├── GET  /api/crowd-heat   — crowd heatmap data
├── POST /api/discover     — find new places that fit the plan
├── GET  /api/food         — nearby restaurants for meal breaks
├── GET  /api/photo        — place photos
├── GET  /api/place        — place details
├── GET  /api/resolve      — geocode an origin address
├── GET  /api/route        — drawable route geometry (OSRM)
├── POST /api/trip-chat    — in-plan AI conversation
└── GET  /api/weather      — 16-day forecast

External Services (all free/open)
├── Google Gemini (gemini-3.5-flash-lite)  — NL understanding
├── OSRM (openstreetmap.de + project-osrm.org) — routing
├── Nominatim (OSM)         — geocoding
├── OpenFreeMap tiles       — map background
├── NYC Planning GeoSearch  — NYC-specific address resolution
└── Open-Meteo              — weather
```

---

## Core Data Flow

### 1. User Describes Their Day

The landing prompt or in-planner text box takes free text. The browser POSTs to `/api/assistant`.

### 2. Gemini Parses Intent → Structured Form

`/api/assistant` sends the text to Gemini with a JSON schema response format.  
Gemini returns:
- `stops[]` — specific attractions or vague wishes ("a skyline view")
- `date`, `startTime`, `endTime`
- `mode` (transit / walk / bike / car)
- `crowd` preference (avoid / balanced / ignore)
- `profile` fields (pace, group, interests)
- `meals` (lunch/dinner breaks)
- `choices[]` — alternatives for vague wishes

The server resolves attraction IDs against the curated catalog (~40 places). Unknown places are geocoded via Nominatim. The final `AssistantResult` is returned to the browser, which then calls `/api/plan`.

### 3. Plan Optimizer → DayPlan

`/api/plan` runs `buildPlan(request)`:

1. **Skip closed stops** — any attraction with `null` hours on the chosen weekday is set aside, not silently dropped.
2. **Build leg matrix** — OSRM's table API returns travel minutes between every pair of stops. Transit mode uses NYC subway station graph + walking estimates; walk/bike/car use real routed times from OSRM.
3. **Crowd profiles** — for each stop, `crowdProfile()` finds up to 8 nearby MTA subway stations within 900 m, weights their hourly ridership by proximity, and produces 24 hourly relative levels (0–1, relative to that day's peak).
4. **Optimize order** — `optimize()` runs depth-first search with branch-and-bound pruning over all stop permutations. The objective function is:

   ```
   cost = travelMin
        + waitMin (for doors to open)
        + crowdWeight × (crowd level × visitMin) for each stop
        + ISSUE_PENALTY if a stop is closed or runs past closing
        + LATE_PENALTY if a fixed-time stop is missed
        + 2 × every minute past the day's end time
   ```

   A greedy nearest-next seed gives a tight upper bound so the search prunes early. For > ~8 stops that exceed a 2M-node budget, an insertion-improvement pass polishes the greedy result.

5. **Insights** — human-readable strings ("This order saves 22 min of travel vs. the order you added them", "The Met is about 40% as busy at 9 am as at 3 pm, its busiest hour").

6. **Return** — full `DayPlan` including `PlannedStop[]` with exact start/end times, leg details (mode, minutes, subway station names, subway line codes), crowd bands, and a `baseline` comparison.

### 4. Map Geometry

The browser calls `/api/route` once per leg to get drawable GeoJSON coordinates. Walk/bike/car legs follow real streets; subway legs draw station-to-station straight lines.

### 5. In-Plan AI Chat

After a plan is built, `TripChat` lets the user ask follow-ups ("swap the afternoon with something outdoors", "make it end at 8 pm"). `/api/trip-chat` re-runs the full assistant + optimizer pipeline with the current plan as context, returning an updated `DayPlan`.

### 6. Discover

The Discover tab finds places that *fit the plan*: nearby, during a free gap, matching the traveler's interests. `/api/discover` queries OSM's Overpass API for real-world POIs near the plan's geographic envelope, scores them against gaps in the day, and returns ranked suggestions.

---

## Key Modules

| Module | Purpose |
|---|---|
| `src/lib/plan/optimize.ts` | Branch-and-bound day optimizer |
| `src/lib/plan/build.ts` | Orchestrates routing → optimization → insight generation |
| `src/lib/plan/crowd.ts` | MTA ridership → hourly relative crowd levels |
| `src/lib/plan/travel.ts` | Builds the leg matrix (OSRM + transit estimates) |
| `src/lib/plan/attractions.ts` | Curated catalog of 40+ NYC attractions with hours/coords |
| `src/lib/plan/profile.ts` | Traveler profile (pace, group, walk tolerance) |
| `src/lib/plan/share.ts` | URL-safe plan encoding/decoding, localStorage |
| `src/lib/plan/ics.ts` | Calendar export (.ics) |
| `src/lib/plan/live.ts` | "Next Up" — current step for today's plans |
| `src/lib/osm/osrm.ts` | OSRM routing table + route geometry |
| `src/lib/osm/nominatim.ts` | Geocoding via OSM Nominatim |
| `src/lib/osm/overpass.ts` | Overpass API queries for POI discovery |
| `src/lib/discover/service.ts` | Discover pipeline: gap detection → POI scoring |
| `src/app/api/assistant/route.ts` | Gemini NL → structured form |
| `src/components/plan/PlannerView.tsx` | Top-level app state and UI |
| `src/components/map/AmbientMap.tsx` | Landing page background map |

---

## Data Sources

| Source | What We Use It For | License |
|---|---|---|
| MTA Subway Hourly Ridership (data.ny.gov) | Crowd proxy for 400+ NYC stations | Open data |
| OpenStreetMap | Map tiles (OpenFreeMap), routing (OSRM), geocoding (Nominatim) | ODbL |
| OSRM (openstreetmap.de) | Walking, biking, car routing tables + geometry | Free public API |
| OSRM (project-osrm.org) | Car routing fallback | Free public API |
| NYC Planning GeoSearch | NYC address resolution | City open data |
| Overpass API | POI discovery queries | ODbL |
| Google Gemini | Natural language → structured intent | Commercial API |
| Open-Meteo | 16-day weather forecast | Free API |

**All map/routing/data costs are zero.** Only Gemini costs money; the assistant step is one call per plan built.

---

## Crowd Data Pipeline

MTA Subway Hourly Ridership is downloaded and pre-processed by `scripts/build-crowd-data.mjs` into a compact JSON bundle shipped with the app (`src/lib/plan/crowd-data.json`). No API call is needed at runtime. Each station has 168 numbers (7 days × 24 hours) representing typical riders per hour.

At plan-build time, `crowdProfile(point, dow)` finds up to 8 stations within 900 m, weights them by distance (full weight ≤ 350 m, fading to zero at 900 m), and produces 24 relative hourly levels normalized to the day's peak so a quiet Sunday is compared against Sunday's busiest hour, not the weekday commute peak.

---

## Routing Strategy

**Transit**: The leg matrix estimates travel time using subway station graph distances and walking speed. Legs over the user's `walkMax` threshold prefer the subway. Board/alight station names and subway line codes are returned for display.

**Walk / Bike / Car**: OSRM's table API is called with all points at once (one request per plan). For walk, up to 4 nearby street-network snap points are tried and the fastest is used — this handles addresses inside blocks that would otherwise route through courtyards.

**Fallback**: If OSRM is unavailable, all legs fall back to Haversine estimates at mode-appropriate speeds.

---

## Plan Encoding / Sharing

Plans are encoded as compact base64 URL parameters (`/plan?plan=<code>`). The codec is in `src/lib/plan/share.ts`. Opening the link re-runs the optimizer on the same request, so shared plans always reflect current opening hours. Saved plans live in `localStorage` on the user's device.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Maps | MapLibre GL 6 + OpenFreeMap tiles |
| Charts | Recharts |
| Validation | Zod |
| AI | Google Gemini (`@google/genai`) |
| Routing | OSRM (public servers) |
| Testing | Vitest |

---

## Deployment

Standard Next.js deployment (Vercel or any Node host). Required environment variables:

```
GEMINI_API_KEY=...   # or GOOGLE_API_KEY
```

The app works in read-only mode (browse map, add stops) without the key; only the AI text prompt requires it.
