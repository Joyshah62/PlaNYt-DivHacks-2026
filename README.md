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

Open http://localhost:3000. The planner needs an account: sign up with email and a phone number, or with Google. Accounts and "Plan with friends" trips live in MongoDB Atlas: put the cluster's connection string in `MONGODB_URI` and run `npm run db:check` to confirm the app can reach it (unset, a local `mongodb://127.0.0.1:27017` is used). Production also needs `BETTER_AUTH_SECRET`.

Groups start at http://localhost:3000/start ("Who's coming?"), which opens a trip room where everyone votes and taps I'm in.

Every other key is optional; see `.env.example` for each one:

Every other key is optional; see `.env.example` for each one:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` add "Continue with Google". Roam asks Google for the phone number on the person's profile, and asks them for one if Google has none.

- `GEMINI_API_KEY` (Google Gemini) enables "Plan it for me" and the trip chat. Uses `gemini-3.5-flash-lite` by default (`GEMINI_MODEL` overrides it). Without it, pick spots by hand.
- `GOOGLE_PLACES_API_KEY` enables live Google ratings and photos. Without it, photos come from Wikipedia.
- `BACKBOARD_API_KEY` lets Roam remember each traveler from one trip to the next ("vegetarian", "staying at the Ace"): one memory per account, on every device; per text thread over iMessage.
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
| `npm run start:imessage` | Same bot without loading `.env` (Render injects env) |

### iMessage

Roam also works over iMessage, through [Photon Spectrum](https://photon.codes/docs/spectrum-ts).
Text the project's line what you'd like to do and the day comes back; text again to
change it ("add Times Square and a café there"). Places come back numbered (reply `2`),
and changes wait for `YES` or `NO`. On the day, the bot sends a morning rundown, and
tells you when to leave for each stop. "Text to my phone" on an itinerary sends a plan
from the website.

**Local**

1. Set `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` in `.env` (Photon dashboard, Settings),
   plus `PHONE_BRIDGE_URL=http://127.0.0.1:4100` and a random `PHONE_BRIDGE_TOKEN` (see `.env.example`).
2. Run `npm run dev`, then `npm run imessage` in a second terminal.

The bot plans through this app's API, so both must be running. Texts understand
`PLAN`, `NEW TRIP`, `STOP` / `START` and `HELP`. Map links in texts use `PUBLIC_APP_URL`
(default `http://localhost:3000`, which won't open on a phone; set it to a deploy or tunnel).

### Deploy on Render

Full handoff: [`docs/HANDOFF-render.md`](docs/HANDOFF-render.md). Blueprint: [`render.yaml`](render.yaml).

**Primary domain:** `https://planyt.tech` · **Bot:** `https://imessage.planyt.tech`

| Service | Plan ID | CPU | RAM | Instances | Region | Domain |
|---------|---------|-----|-----|-----------|--------|--------|
| `roam-web` | `1c-2g` (Standard) | 1 | 2 GB | 1 | `ohio` | `planyt.tech` |
| `roam-imessage` | `0.5c-512mb` (Starter) | 0.5 | 512 MB | 1 | `ohio` | `imessage.planyt.tech` |

Do **not** use Free (sleeps). Do **not** use a Background Worker for the bot. Do **not** scale the bot above 1 instance. Copy `PHONE_BRIDGE_TOKEN` to both services. Google OAuth redirect: `https://planyt.tech/api/auth/callback/google`.

## Important limitations

- Crowd profiles describe neighborhood activity, not conditions inside a venue.
- Published opening hours can be stale and may not reflect holidays or seasonal changes.
- Subway times are estimates for ordering stops. Use the linked Google Maps directions for live service and directions.
- Public routing and geocoding services are rate-limited. Roam falls back to straight-line travel estimates if routing is unavailable.
- Saved plans are stored in the current browser. Shared links encode the request and rebuild the plan when opened.

## Data and attribution

Roam uses MTA Subway Hourly Ridership, OpenStreetMap contributors, OSRM, Nominatim, NYC Planning GeoSearch, OpenFreeMap, Open-Meteo, Wikipedia/Wikimedia Commons, and optionally Google Places. See [architecture and data sources](docs/architecture.md#data-sources) for how each is used.
