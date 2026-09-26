# Roam NYC

**See New York, not the crowds.** Tell Roam what you want to see. It works out
the best order and the best times: less travel, fewer crowds, nothing closed
when you arrive.

Built for DivHacks 2026 · **Move Smarter** track.

## The problem

A first-time visitor with one day in New York usually makes the same mistakes.
They zig-zag between boroughs, reach the Met on a Wednesday (when it's closed),
and turn up at Top of the Rock at 5pm with everyone else. Map apps route you
between two points. None of them decide the order of your whole day, or when
each stop is at its quietest.

## What Roam does

1. **Pick or describe your day.** Tap spots on the map, choose from 40+ curated
   places, search any restaurant or address, or just type *"Saturday with my
   parents: the Met, a skyline view and great pizza. We hate crowds."*
2. **Choose how you'll get around:** subway + walking, walking, bike, or car.
3. **Get an ordered, timed itinerary.** Each stop gets a time slot, travel
   between stops is drawn on the map, and each stop has an hour-by-hour
   **crowd strip** showing why it was scheduled when it was.
4. **Get there.** Every leg has a one-tap link to that trip in Google Maps, with
   live transit times and turn-by-turn directions. Walking, cycling and driving
   days also open as one multi-stop route.
5. **Make it yours.** A 20-second travel style (pace, who's coming, how far
   you'll walk, what you're into) changes the plan itself: relaxed days get
   longer visits and breathers between stops, walks over your limit go by
   subway, and "Picked for you" suggests places that fit. Pin set times for
   bookings (a ferry, a show) and add lunch or dinner breaks, which fall
   wherever you are at mealtime. A food stop in the day counts as the meal.
   Vague wishes ("a skyline view", "pizza") and meal breaks come with 3–4
   options. Each one is tried in the whole day, and its card shows what it
   changes: extra travel, time slot, crowds, whether it's closed. The best
   fit is marked, and one tap re-plans the day around your pick. Lunch and
   dinner options are real restaurants near where you'll be then.
6. **Running late? Re-plan from here.** Mid-day, share your location (or pick
   where you are), tick what's done, and the rest of the day is planned again.
7. **Tap any place** (a map dot, a card, a stop) for a photo, today's hours,
   when the area is quietest, and a button to add it or get directions.
8. **Save or share the day.** Saved plans stay on this device; the copied link
   rebuilds the same day anywhere.

The plan explains itself in plain language, for example: *"This order saves
44 min of travel versus the order you added the stops"*, *"The Met at 10:44am:
the area is about 38% as busy as at 4pm"*, or *"The Met is usually closed on
Wednesdays, so it's left out."*

## How it works

```text
 "Saturday, the Met, a view, pizza"          picked on the map
              │                                      │
      Gemini (structured output) ──► stops, day, mode, crowd preference
                                                     │
            ┌────────────────────────────────────────┼──────────────────────────┐
            ▼                                        ▼                          ▼
   Travel matrix (every pair)          Crowd profile per stop           Opening hours
   OSRM walk/bike/car on OSM           MTA hourly ridership near         per weekday
   + subway estimate via stations      the stop, by weekday & hour
            └────────────────────────────────────────┼──────────────────────────┘
                                                     ▼
                  Optimizer: tries every order, simulated through the clock
                                                     ▼
                     Timed itinerary + map + plain-language reasons
```

**The AI does not plan the day.** Gemini only reads a free-text request into
structured fields (which places, which day, how you'll travel). The ordering
and timing are computed by deterministic code, so the same inputs always give
the same plan, and every choice can be explained.

### The optimizer

Every possible order of the stops is played out through the day: travel to the
stop, wait if it isn't open yet, visit, move on. Each order is scored in minutes:

```
travel + waiting + crowd weight × (crowd level × visit minutes)
+ a large penalty for arriving at a closed place or running past closing
+ 2 × minutes past the end of the day
```

Set times, meals and breathers are part of the same simulation. A stop with
a set time can't start earlier, and arriving late is heavily penalized. A meal
has a preferred window (lunch 11:30–1:30, dinner 6–8:30): it never starts
before the window, and starting after it costs a little per minute. A meal
break "floats": getting there takes no travel, and the next leg starts from
the last real place.

Every term is non-negative, so a branch-and-bound search can drop any partial
order that already costs more than the best complete one. For a day's worth of
stops (up to 10) this finds the true optimum in well under a second. If the
search budget runs out, a local-improvement pass polishes the best order found.
Stops that are closed all day are set aside rather than scheduled. See
[src/lib/plan/optimize.ts](src/lib/plan/optimize.ts).

### Crowd levels

[MTA Subway Hourly Ridership](https://data.ny.gov/d/5wq4-mkjj) records how many
people enter every station, every hour. For each stop, Roam adds up ridership at
the stations within walking distance (nearer stations count more) for the chosen
weekday. It then expresses each hour as a share of that area's busiest hour of
the day.

This measures **area busyness**: foot traffic on the streets around a place.
It is not a headcount inside the venue, because venue-level crowd data isn't
public, and the UI says so. [scripts/build-crowd-data.mjs](scripts/build-crowd-data.mjs)
builds the profiles from the median of the last 5 full weeks, so one holiday
week doesn't skew the typical day. The result is committed
([src/lib/plan/crowd-data.json](src/lib/plan/crowd-data.json)) and planning
never waits on the MTA API.

### Photos, and the Google cap

The place card shows a Google Places photo when a key with **Places API (New)**
is configured, and a freely licensed Wikipedia / Wikimedia Commons photo
otherwise. Every photo is shown with its author credit and license.

Google usage is capped in code
([src/lib/plan/photos.ts](src/lib/plan/photos.ts)) so the project stays within
Google's free monthly usage:

- One photo lookup is at most two billable calls: a Text Search, with a field
  mask limited to photo references, and a Place Photo call.
- The monthly cap (default **900** lookups) is under the smallest free
  allowance of any Places SKU (1,000 a month). A daily cap (default **100**)
  stops one busy day from using up the month.
- Lookups are counted before the call and saved to `.data/` (git-ignored). A
  refused call (API disabled, key restricted) gives its unit back and pauses
  Google for 10 minutes.
- Photo URLs are kept in memory for 6 hours, and simultaneous requests for the
  same place share one lookup.
- Past the cap, photos fall back to Wikipedia.

Also set a quota in Google Cloud: that's the one limit this code can't bypass.
The counter lives on local disk, so on serverless hosts it resets on each cold
start.

Catalog photos from Wikipedia are pre-resolved with credits by
[scripts/build-photo-data.mjs](scripts/build-photo-data.mjs). Places you
search for are looked up live, and a result is used only if its coordinates
are within 400 m of the place.

### Travel times

- **Walk, bike, car:** real street routes from [OSRM](https://project-osrm.org/)
  on OpenStreetMap, fetched as one matrix per plan. Car times are scaled up
  for city traffic, and parking time is added.
- **Subway + walk:** for each leg, whichever is faster: walking, or an
  estimate of walking to a nearby station, waiting, riding, and walking out.
  Lines come from the MTA station names ("86 St (4,5,6)"). If two stations
  share a line, it's one ride; otherwise the estimate adds a transfer at the
  station that adds the least distance. Express trunk lines count as faster
  than locals. These times are only for ordering the day, so subway legs are
  marked `~`.
- **Getting there:** Roam doesn't give its own directions. Each leg links to
  Google Maps (a plain URL, no API key, no cost), which has live schedules,
  service changes and turn-by-turn.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- Gemini (`gemini-3.5-flash-lite`) through Google's `@google/genai` SDK,
  using structured output with a JSON Schema generated from a Zod schema
- MapLibre GL with OpenFreeMap tiles
- Tailwind CSS 4, shadcn/ui on Base UI, lucide icons
- Zod request validation, Vitest unit tests

## Getting started

Requires Node.js 20+.

```bash
git clone https://github.com/Joyshah62/divhacks-2026.git
cd divhacks-2026
npm install
cp .env.example .env.local   # optional: Gemini key (assistant), Google Places key (photos)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Both keys are optional. Without a Gemini key, everything works except
"Plan it for me"; pick spots by hand instead. Without a Google key, photos
come from Wikipedia.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm test` | Run the Vitest suite |
| `npm run lint` | Run ESLint |
| `npm run crowd-data` | Rebuild crowd profiles from the latest MTA ridership (~30 s) |
| `npm run poi-data` | Rebuild the local copy of NYC places from OpenStreetMap, used by "Find something that fits my trip" (a few minutes) |
| `node scripts/build-photo-data.mjs` | Rebuild catalog photos and credits from Wikipedia |

## API

| Endpoint | Does |
|---|---|
| `POST /api/plan` | Stops + day + mode + crowd preference → ordered, timed itinerary with reasons |
| `POST /api/assistant` | Free text → stops and settings (Gemini), with places geocoded |
| `GET /api/resolve?q=` | Any NYC place or address → a point (NYC GeoSearch, Nominatim) |
| `GET /api/route?from=&to=&mode=` | Street geometry for one leg (walk, bike, car), for the map |
| `GET /api/place?id=` or `?lat=&lon=` `&date=` | Hours, hourly area busyness and the quietest time for one place |
| `GET /api/photo?id=` or `?name=&lat=&lon=` | One photo with credit (Google, capped; else Wikipedia) |

## Project structure

```text
src/
  app/                 landing page, /plan, API routes
  components/plan/     planner view, map, itinerary, crowd strip, stop picker
  lib/plan/            optimizer, crowd model, travel matrix, attraction catalog
  lib/osm/             OSRM routing, Nominatim geocoding
scripts/               crowd-data builder, MapLibre worker copy
```

## Limitations

- Crowd levels describe the area around a place, not the queue inside it.
- Opening hours are typical published hours; holidays and seasons vary.
- Subway times are estimates for ordering the day, without live schedules or
  service changes. Follow the Google Maps link for the actual trip.
- Saved plans live in this browser's storage; the share link is the portable copy.
- Public routing and geocoding servers are free and rate-limited; if routing
  is down, the plan falls back to straight-line estimates and says so.

## Data sources

[MTA Subway Hourly Ridership](https://data.ny.gov/d/5wq4-mkjj) (data.ny.gov),
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors,
[Wikipedia](https://www.wikipedia.org/) and Wikimedia Commons photographers
(credited per photo), Google Places photos (when enabled),
[OSRM](https://project-osrm.org/) via FOSSGIS, [Nominatim](https://nominatim.org/),
[NYC Planning GeoSearch](https://geosearch.planninglabs.nyc/), and
[OpenFreeMap](https://openfreemap.org/).
