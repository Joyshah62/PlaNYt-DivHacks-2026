# PlaNYt

**See New York, not the crowds.** PlaNYt turns preferences (via text, voice, or manual selection) into optimized NYC itineraries, balancing travel time, opening hours, and neighborhood crowds. Plan solo or with friends—everyone votes on stops and the itinerary re-optimizes as preferences align.

Built for DivHacks 2026 · **Move Smarter** track.

## Quick Start

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Features

**Solo Planning**
- Describe a day in plain language: *"Saturday with my parents: the Met, a skyline view and great pizza. We hate crowds."*
- Add stops manually by browsing the 40+ curated NYC attractions
- Review an optimized itinerary with times, travel legs, opening-hour checks, and crowd forecasts
- Compare alternatives and adjust the plan via chat

**Group Planning**
- Create a trip room at `/start` — invite friends by link
- Everyone votes on stop candidates; PlaNYt re-optimizes as votes roll in
- Real-time voting, approval flow, and a final itinerary
- All votes and decisions stay in the room until everyone confirms

**Accessibility**
- Voice input/output (speech-to-text, text-to-speech)
- Diet/allergy preferences stored per person
- Budget planning and alerts

**Sharing & Export**
- Shareable trip URLs; no account needed to view or edit
- Save trips locally (browser storage) or to your account
- Export to calendar (.ics)
- iMessage bot for text-based planning

## Under the Hood

The planner works in two stages:

1. **Intent extraction** (Gemini): Free text → structured request (places, date, mode, constraints)
2. **Optimization** (deterministic code): Evaluate all orderings of stops. Score by travel time, crowd levels (via MTA ridership), opening hours, and preferences. Return the best order with explanations.

This separation means every output is reproducible and explainable — no hidden randomness.

**Crowd data** comes from MTA Subway Hourly Ridership (open data), measuring area busyness around each stop by nearby station foot traffic.

**Routing** uses OSRM for walk/bike/car (via openstreetmap.de), subway estimates from station distances + walking, and Google Maps links for live directions.

## Deployment

```bash
npm run build
npm start
```

Environment variables: see `.env.example`. All are optional except `BETTER_AUTH_SECRET` in production.

**MongoDB** (optional): For group trips and saved plans. Unset, local `mongodb://127.0.0.1:27017` is used.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest |
| `npm run crowd-data` | Rebuild MTA crowd profiles |
| `npm run poi-data` | Rebuild OSM place dataset |
| `npm run imessage` | Start iMessage bot (requires `.env` keys) |

## Data & Attribution

- **MTA Subway Hourly Ridership** (data.ny.gov) — area busyness proxy, not venue attendance
- **OpenStreetMap** contributors — map tiles, routing, geocoding
- **OSRM** (via FOSSGIS and project-osrm.org) — street routing
- **Google Gemini** — natural language understanding
- **Google Places** — live photos and ratings (optional)
- **Wikipedia/Wikimedia** — catalog photos with attribution
- **Open-Meteo** — weather forecasts

## Limits & Honesty

- Crowd levels estimate *area* foot traffic, not queue length inside venues
- Published hours may be outdated; holidays vary
- Subway times are planning estimates, not live schedules—use Google Maps for real-time directions
- Saved solo plans live in browser storage; group trips live in MongoDB
- Routing servers are public and rate-limited; falls back to straight-line estimates if unavailable
