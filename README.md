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

Open http://localhost:3000. `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) enables natural-language planning. `GOOGLE_PLACES_API_KEY` enables live Google place photos. Both are optional; manual planning and catalog photos work without them. `MONGODB_URI` (MongoDB Atlas) stores "Plan with friends" group trips; without it trips live in the dev server's memory. Groups start at http://localhost:3000/start ("Who's coming?"), which opens a trip room where everyone votes and taps I'm in.
Open http://localhost:3000. Every key is optional; see `.env.example` for each one:

- `GROK_API_KEY` (xAI) enables "Plan it for me" and the trip chat. Without it, pick spots by hand.
- `GOOGLE_PLACES_API_KEY` enables live Google ratings and photos. Without it, photos come from Wikipedia.
- `BACKBOARD_API_KEY` lets Roam remember each traveler from one trip to the next ("vegetarian", "staying at the Ace"): per device on the web, per thread over iMessage.
- `TAVILY_API_KEY` lets the trip chat look up current facts on the web.

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Build / serve production app |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest |
| `npm run crowd-data` | Rebuild crowd profiles from the latest MTA ridership (~30 s) |
| `npm run poi-data` | Rebuild the local copy of NYC places from OpenStreetMap, used by "Find something that fits my trip" (a few minutes) |
| `node scripts/build-photo-data.mjs` | Rebuild catalog photos and credits from Wikipedia |
| `npm run imessage` | Start the iMessage bot next to the dev server (see below) |

### iMessage

Roam also works over iMessage, through [Photon Spectrum](https://photon.codes/docs/spectrum-ts).
Text the project's line what you'd like to do and the day comes back; text again to
change it ("add Times Square and a café there"). Places come back numbered (reply `2`),
and changes wait for `YES` or `NO`. On the day, the bot sends a morning rundown, and
tells you when to leave for each stop. "Text to my phone" on an itinerary sends a plan
from the website.

1. Set `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` in `.env` (Photon dashboard, Settings),
   plus `PHONE_BRIDGE_URL` and a random `PHONE_BRIDGE_TOKEN` for the website button (see `.env.example`).
2. Run `npm run dev`, then `npm run imessage` in a second terminal.

The bot plans through this app's API, so both must be running. Texts understand
`PLAN`, `NEW TRIP`, `STOP` / `START` and `HELP`. Map links in texts use `PUBLIC_APP_URL`
(default `http://localhost:3000`, which won't open on a phone; set it to a deploy or tunnel).

## Important limitations

- Crowd profiles describe neighborhood activity, not conditions inside a venue.
- Published opening hours can be stale and may not reflect holidays or seasonal changes.
- Subway times are estimates for ordering stops. Use the linked Google Maps directions for live service and directions.
- Public routing and geocoding services are rate-limited. Roam falls back to straight-line travel estimates if routing is unavailable.
- Saved plans are stored in the current browser. Shared links encode the request and rebuild the plan when opened.

## Data and attribution

Roam uses MTA Subway Hourly Ridership, OpenStreetMap contributors, OSRM, Nominatim, NYC Planning GeoSearch, OpenFreeMap, Open-Meteo, Wikipedia/Wikimedia Commons, and optionally Google Places. See [architecture and data sources](docs/architecture.md#data-sources) for how each is used.
