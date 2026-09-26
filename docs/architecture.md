# Roam NYC — System Architecture

This document describes how the current application is organized. Product goals and demo flow live in [MVP](MVP.md); user-facing interaction details live in [UI/UX](UI-UX.md).

## System overview

```text
Browser
  /             Landing page; prompt links to /plan?q=...
  /plan         Planner UI, map, itinerary and local state
       │
       ├── /api/assistant  Gemini intent extraction → structured request
       ├── /api/plan       deterministic route + schedule optimization → DayPlan
       ├── /api/plan/*     comparisons and multi-day/day data
       ├── /api/trip-chat  conversational changes → updated plan
       ├── /api/discover   place suggestions for itinerary gaps
       └── /api/*          place, route, food, photo, crowd and weather data
```

The browser owns interactive planner state. The server validates requests, calls external data services as needed, and builds plans. Plans can be encoded in a URL or saved in browser storage; the app does not require a user account or database.

## Planning request flow

1. `/api/assistant` converts free text to a validated structured request using Gemini and a Zod-derived schema. It resolves catalog places and geocodes unknown NYC places where possible. Manual planning can call `/api/plan` directly.
2. `buildPlan()` gathers travel estimates, attraction hours, and crowd profiles.
3. The optimizer simulates candidate stop orders through the day, including travel, waiting, visits, meals, fixed-time stops, opening hours, crowd preference, and end-time constraints.
4. The best order found is returned as a `DayPlan` with stop times, legs, crowd data, and explanatory insights.
5. The browser requests route geometry for map display. Choosing an alternative or changing the plan runs the relevant planning flow again.

AI interprets user intent; it does not choose the final schedule. For typical small itineraries, branch-and-bound can find the optimum. A search budget and improvement pass handle larger requests, so do not describe every possible itinerary as guaranteed optimal.

## Planning data and estimates

### Travel

- Walk, bike, and car travel matrices use OSRM street routing when available. Car times include a city-traffic adjustment and parking overhead.
- Subway-plus-walk times are estimates based on nearby stations, line connectivity, walking, waiting, and transfer costs; there are no live departures or service alerts.
- Routing failure falls back to mode-based straight-line estimates. `/api/route` supplies map geometry; Google Maps links supply live turn-by-turn directions.

### Crowds

`scripts/build-crowd-data.mjs` preprocesses MTA Subway Hourly Ridership into the checked-in `src/lib/plan/crowd-data.json`. For a stop and weekday, nearby stations are distance-weighted into an hourly profile normalized to that day's peak. This is a neighborhood activity proxy, not venue-level attendance.

### Hours and places

The curated attraction catalog contains coordinates, categories, typical hours, visit durations, and other planning metadata. Discover uses a bundled OSM-derived dataset and can query Overpass for suggestions. Published hours and OSM records may be incomplete or stale.

### Photos

Catalog photo metadata is built from Wikipedia/Wikimedia Commons with attribution. If configured, Google Places can resolve live photos for searched places. The lookup has in-process caching and a local usage counter; the counter is not shared across serverless instances, so configure a Google Cloud quota for a hard provider-side limit.

## API routes

| Route | Purpose |
|---|---|
| `POST /api/assistant` | Parse a natural-language request into structured planning input |
| `POST /api/plan` | Build an optimized itinerary |
| `POST /api/plan/compare` | Compare a place/choice by replanning |
| `GET /api/plan/days` | Day overview data |
| `GET /api/crowd-heat` | Crowd heatmap data |
| `POST /api/trip-chat` | Apply conversational edits to a plan |
| `POST /api/discover` | Find places that fit plan gaps and interests |
| `GET /api/food` | Find meal options near a planned location |
| `GET /api/place` | Place details, hours, and crowd profile |
| `GET /api/photo` | Photo URL and attribution |
| `GET /api/resolve` | Resolve an NYC place/address to coordinates |
| `GET /api/route` | Route geometry for a leg |
| `GET /api/weather` | Forecast used by the day picker |

## Code map

| Path | Responsibility |
|---|---|
| `src/app/`, `src/app/api/` | Pages and API route handlers |
| `src/components/plan/` | Planner, itinerary, place details, chat, Discover |
| `src/components/map/` | Map components and styles |
| `src/lib/plan/build.ts` | Planning orchestration |
| `src/lib/plan/optimize.ts` | Stop-order and schedule optimizer |
| `src/lib/plan/travel.ts` | Travel matrix and transit estimates |
| `src/lib/plan/crowd.ts` | MTA-derived crowd profiles |
| `src/lib/plan/attractions.ts` | Curated place catalog |
| `src/lib/plan/share.ts`, `ics.ts` | Share/save and calendar export |
| `src/lib/discover/` | Place discovery and ranking |
| `src/lib/osm/` | Geocoding, routing, and OSM queries |
| `scripts/` | Dataset builders and MapLibre worker setup |

## Data sources

| Source | Use |
|---|---|
| [MTA Subway Hourly Ridership](https://data.ny.gov/d/5wq4-mkjj) | Preprocessed neighborhood crowd proxy |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Place data, geocoding, and routing map data (ODbL attribution applies) |
| [OSRM](https://project-osrm.org/) | Street travel estimates and geometry via public routing services |
| [Nominatim](https://nominatim.org/) | Geocoding |
| [NYC Planning GeoSearch](https://geosearch.planninglabs.nyc/) | NYC address lookup |
| [OpenFreeMap](https://openfreemap.org/) | Map tiles |
| [Open-Meteo](https://open-meteo.com/) | Forecast data |
| Wikipedia / Wikimedia Commons | Catalog photos with per-photo credit/license |
| Google Places (optional) | Live photo lookup |
| Google Gemini (optional key) | Natural-language intent extraction and chat |

Public service availability and terms can change. Respect each provider’s attribution, usage, and rate limits.

## Local development and configuration

Requires Node.js 20+. Run `npm install`, copy `.env.example` to `.env.local`, then `npm run dev`. Gemini and Google Places keys are optional; manual planning and catalog photos work without them.

Use `npm run crowd-data`, `npm run poi-data`, and `node scripts/build-photo-data.mjs` to rebuild bundled datasets. Other commands are listed in the [README](../README.md).
