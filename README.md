# RentCheck NYC

**Enter an NYC apartment address and instantly understand the building, the
neighborhood, and the commute — before you sign the lease.**

RentCheck NYC pulls public housing records and open map data into one report so
renters can answer a simple question: *is this actually a good place for me to live?*

Built for DivHacks 2026.

## Features

- **Building health** — HPD violations (open vs. resolved, class A/B/C), housing
  complaints, the most common problem types, and trends over time, joined with
  PLUTO building data.
- **Around you** — groceries, food, cafes, gyms, parks, pharmacies, transit and
  more from OpenStreetMap, with walking times to the nearest of each.
- **Getting around** — walking and driving estimates to popular destinations and
  to places you add yourself (work, school, friends).
- **Interactive map** — 5/10/15-minute walking zones, place pins, and route lines
  to any place you tap.
- **Your priorities** — an optional preferences step (what matters to you, where
  you travel often) that tailors the report.
- **Viewing checklist** — what to ask and inspect during a visit, based on the
  building's actual history.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- Tailwind CSS 4, shadcn/ui on Base UI, lucide icons
- MapLibre GL with OpenFreeMap tiles, Recharts
- Zod for validating upstream API responses
- Vitest for unit tests

## Getting started

Requires Node.js 20+.

```bash
git clone https://github.com/Joyshah62/divhacks-2026.git
cd divhacks-2026
npm install
cp .env.example .env.local   # optional, see below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and search for an NYC address.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |

### Environment variables

Everything works without any keys. These are optional:

| Variable | Purpose |
|---|---|
| `NYC_APP_TOKEN` | NYC Open Data app token; raises the anonymous Socrata rate limit. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Enables Street View photos in the report header (see below). |

## How a report is built

Search → `/preferences` (optional priorities and frequent destinations, carried in
the URL as `p=` and `to=`) → `/report`. The report page makes independent
requests, so each section renders as soon as its own data lands:

| Endpoint | Source | Feeds |
|---|---|---|
| `/api/address-suggest` | NYC Planning GeoSearch | Search autocomplete |
| `/api/locate` | NYC Planning GeoSearch | Address, coordinates |
| `/api/building-report` | NYC HPD + PLUTO (Socrata) | Building health |
| `/api/nearby` | OpenStreetMap via Overpass, OSRM foot routing | Overview, Nearby tab, map pins |
| `/api/commute` | OSRM driving/walking, Nominatim for custom destinations | Commute tab |
| `/api/isochrone` | Valhalla (FOSSGIS) pedestrian isochrones | 5/10/15-minute walking zones on the map |
| `/api/route` | OSRM route geometry | Walking/driving line to a tapped place or destination |

All neighborhood sources are free public servers with fair-use limits; results
are cached in memory for 30 minutes, and every time shown is a route estimate
(no live traffic, no transit). Straight-line fallbacks are marked with `~`.

The map uses MapLibre with OpenFreeMap tiles. MapLibre's web worker is copied
into `public/maplibre/` by `scripts/copy-maplibre-worker.mjs` (runs on install,
dev and build) because bundlers cannot follow its runtime worker URL.

## Project structure

```text
src/
  app/            pages (/, /preferences, /report) and API routes
  components/     report sections, map, preferences form, UI primitives
  lib/nyc/        GeoSearch, Socrata queries, violation classification & analysis
  lib/osm/        Overpass, OSRM, Nominatim, isochrones, place categories
  lib/            preferences, checklist, shared helpers
scripts/          build-time helpers
```

## Building imagery

The report header uses optional Google Street View photography and a Google Maps
address link. To enable photos, enable **Street View Static API** and billing in
Google Cloud, then set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`.
Restrict this browser-visible key to your website referrers and the Street View
Static API. Add your localhost origin for development. Restart the dev server
or rebuild after changing the value; Next.js embeds public variables at build time.

Without a key, or when photography fails to load, the header still offers an
address-specific Google Maps link. Imagery may be dated or show a nearby entrance
and is not evidence of current building conditions.

## Roadmap

- Personalized match score. It will be deterministic, not LLM-decided;
  `computeMatch()` in `src/lib/preferences.ts` already receives every input it
  needs.
- Newark / New Jersey building data.
- Apartment comparison and saved searches.

## Data sources

[NYC Open Data](https://opendata.cityofnewyork.us/) (HPD violations & complaints,
PLUTO), [NYC Planning GeoSearch](https://geosearch.planninglabs.nyc/),
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors,
[OSRM](https://project-osrm.org/), [Valhalla / FOSSGIS](https://valhalla.openstreetmap.de/),
[Nominatim](https://nominatim.org/), and [OpenFreeMap](https://openfreemap.org/).
