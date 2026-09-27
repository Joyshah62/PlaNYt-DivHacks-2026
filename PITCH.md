# PlaNYt — Product Overview

**See New York, not the crowds.** PlaNYt turns a visitor's preferences (via natural language, voice, or manual selection) into an optimized NYC itinerary. It balances travel time, opening hours, and area crowdedness. Plan solo or with friends—everyone votes and the itinerary re-optimizes as preferences align.

Built for DivHacks 2026 · **Move Smarter** track.

## The Problem

NYC gets 65 million visitors per year. Most plan the same broken way:
- Spend hours in browser tabs (TripAdvisor, Google Maps, travel blogs)
- Visit iconic places at peak times (11am at the Met on Saturday)
- Itineraries zigzag across the city (1–2 hours of wasted travel per day)
- Places are closed when they arrive (Met closed Wednesdays—most find out after)
- Lunch "wherever" becomes an expensive afterthought
- Group planning is impossible—how do you order five people's wishes?

## The Solution

PlaNYt takes one sentence—*"Saturday with my partner: a museum, a skyline view, the Brooklyn Bridge, and pizza. Avoid crowds."*—and produces a complete, timed, optimized itinerary:

- **Ordered by travel efficiency** — the stops in the sequence that minimizes total travel time
- **Timed to quiet hours** — using MTA subway ridership data to know when each area is least crowded
- **Validated against opening hours** — it won't put you at the Met on a Wednesday
- **Routed on real streets** — OSRM on OpenStreetMap draws your exact path
- **Continuously adjustable** — chat with it, compare alternatives, re-plan from now if running late
- **Group voting** — friends vote on stops; PlaNYt re-optimizes as votes roll in; everyone approves before committing

## What's Built

**Solo Planning**
- [x] Natural language input (Gemini) + voice I/O (Web Speech API, iMessage)
- [x] Manual place browsing (40+ curated + search)
- [x] Itinerary optimization (exact for ≤~8 stops, heuristics for larger)
- [x] Crowd avoidance (MTA data, area foot traffic proxy)
- [x] Real routing (OSRM walk/bike/car, subway estimates, Google Maps links)
- [x] Meal breaks (lunch + dinner with nearby options)
- [x] Fixed times (shows, ferries, reservations)
- [x] Travel styles (pace, group type, walk tolerance, interests)
- [x] Day playback (animated route through the itinerary)

**Group Planning**
- [x] Trip creation and sharing (no account needed to join)
- [x] Real-time voting on stop candidates
- [x] Automated itinerary generation from votes
- [x] Approval flow (vote → generate candidates → approve → confirm)
- [x] Conversational group adjustments ("add something outdoor", "earlier end")

**UX & Export**
- [x] Responsive desktop + mobile (bottom sheet on phones)
- [x] Shareable links (plan encoded in URL)
- [x] Saved trips (browser storage or MongoDB for accounts)
- [x] Calendar export (.ics)
- [x] iMessage bot (for text-based planning and updates)
- [x] Accounts (better-auth: email, phone, Google OAuth)
- [x] Dark mode + theme switching

## Key Differentiators

**1. Real crowd data.**  
Google Maps shows "Popular times" (vague bar chart). PlaNYt uses MTA Subway Hourly Ridership—actual people counts at every station, every hour—distance-weighted by neighborhood, and bakes it into the optimizer as a cost, not a label.

**2. Exact optimizer, not greedy.**  
Depth-first search with branch-and-bound pruning. For typical days (4–6 stops), we check every possible order and prove optimality. Competitors use nearest-next (fast but suboptimal). The insights strip shows users exactly what they saved.

**3. Built entirely on open data.**  
No Google Maps API ($). No proprietary data. MTA open data + OpenStreetMap + OSRM + Nominatim + Open-Meteo. The only paid service is Gemini for intent extraction—and the app works in manual mode with no API key.

**4. Group consensus, not compromise.**  
Voting isn't just a tally. Every vote triggers a re-optimization, so the itinerary evolves as preferences align. Everyone sees the same plan at the same time; approval gates prevent accidental commits.

## Tech Stack

- **Runtime:** Next.js 16 + React 19 + TypeScript
- **Design:** Editorial/magazine style (Google 3D maps on landing, MapLibre on planner)
- **Database:** MongoDB (groups, saved plans, auth state)
- **Auth:** better-auth (email, phone, Google OAuth)
- **AI:** Google Gemini (structured JSON intent extraction)
- **Routing:** OSRM (walk/bike/car) + subway estimates + Google Maps (live)
- **Maps:** Google 3D (landing) + MapLibre GL (planner)
- **Voice:** Spectrum.ts (iMessage), Web Speech API (browser)
- **Validation:** Zod
- **Testing:** Vitest

**Cost to serve:** Near-zero for public endpoints. One Gemini call per plan (~$0.0003), batch iMessage requests.

## Demo Flow (3–5 min)

### 1. Solo Planner (1.5 min)
- Enter a request: *"Saturday afternoon in Manhattan: a museum, a skyline view, and great pizza. Subway and walking, avoid crowds."*
- Show the resulting itinerary: time, travel legs, crowd chart for each stop
- Click a stop: explain the crowd strip (MTA station ridership, normalized to the day's peak)
- Compare a different skyline option and replan

### 2. Group Voting (1.5 min)
- Open `/start` and create a trip
- Invite friends (share link, no account needed)
- Have a friend vote on a stop candidate
- Show the candidates updating in real-time
- Approve and confirm the final itinerary

### 3. Chat & Export (1 min)
- Ask TripChat: *"Make it end by 7pm"*
- Show the replan
- Export to calendar

## Scaling & Monetization

- **Multi-city support:** Same architecture, different attraction catalogs + crowd data sources
- **Live transit data:** Integrate MTA real-time feeds for actual departure times
- **Collaborative editing:** Multi-person simultaneous plan adjustments
- **Offline mode:** Cache maps and routes for use while walking around
- **Premium:** Group planning tier, multi-day trips, advanced analytics
- **Partnerships:** White-label for hotel concierge apps, booking platform integrations

## Why It Matters

Planning a day in a new city is cognitively expensive. Most tools make you choose two points and show you one route. PlaNYt handles the hard parts (order, timing, availability, crowds, logistics) so users can focus on what only they know: what they want to see. Every choice is explainable; no hidden decisions.

For groups, the consensus model replaces the usual friction (coordinating schedules, arguing about order) with automatic re-optimization. Everyone votes; PlaNYt finds the best itinerary that honors those votes. It's faster, fairer, and produces better plans than any one person could negotiate alone.
