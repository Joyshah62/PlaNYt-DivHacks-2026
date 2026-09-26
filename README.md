# Roam NYC

**See New York, not the crowds.** Roam turns a visitor’s preferences into a timed NYC itinerary, balancing travel, opening hours, and neighborhood crowd patterns.

Built for DivHacks 2026 · Move Smarter track.

## Start here

- [Product and MVP](docs/MVP.md) — audience, goals, current scope, and demo flow.
- [System architecture](docs/architecture.md) — request flow, planning logic, data, and code map.
- [UI/UX guide](docs/UI-UX.md) — page structure, interactions, responsive behavior, and accessibility.
- [Archived RentCheck concept](rentcheck_hackathon_plan.md) — separate earlier product idea; not the active application.

## What Roam does

Describe a day in plain language or choose places manually. Roam creates an ordered itinerary with visit times, travel legs, opening-hour checks, and a crowd profile for each stop. Users can adjust the plan, compare alternatives, discover nearby places, save or share it, and export it to a calendar.

The AI extracts structured preferences. Deterministic code handles scheduling and scoring, so the itinerary can be reproduced and its tradeoffs explained. Crowd levels estimate busyness around a place using nearby subway ridership; they do not measure queues or venue attendance.

## Run locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) enables natural-language planning. `GOOGLE_PLACES_API_KEY` enables live Google place photos. Both are optional; manual planning and catalog photos work without them.

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Build / serve production app |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest |
| `npm run crowd-data` | Rebuild bundled MTA crowd profiles |
| `npm run poi-data` | Rebuild the local Discover places dataset |
| `node scripts/build-photo-data.mjs` | Rebuild catalog photo metadata |

## Important limitations

- Crowd profiles describe neighborhood activity, not conditions inside a venue.
- Published opening hours can be stale and may not reflect holidays or seasonal changes.
- Subway times are estimates for ordering stops. Use the linked Google Maps directions for live service and directions.
- Public routing and geocoding services are rate-limited. Roam falls back to straight-line travel estimates if routing is unavailable.
- Saved plans are stored in the current browser. Shared links encode the request and rebuild the plan when opened.

## Data and attribution

Roam uses MTA Subway Hourly Ridership, OpenStreetMap contributors, OSRM, Nominatim, NYC Planning GeoSearch, OpenFreeMap, Open-Meteo, Wikipedia/Wikimedia Commons, and optionally Google Places. See [architecture and data sources](docs/architecture.md#data-sources) for how each is used.
