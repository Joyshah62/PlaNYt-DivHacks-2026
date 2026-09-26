# Roam NYC — MVP Overview & Pitch Guide

## The One-Line Pitch

**Roam NYC is the AI trip planner that tells you *when* to go, not just *where* — built on real MTA crowd data so you see New York without the lines.**

---

## The Problem

Tourists and visitors to NYC have a broken planning workflow:
- They spend hours with browser tabs open on TripAdvisor, Google Maps, and travel blogs
- They visit the most iconic places at the most crowded times (11am at the Met on a Saturday)
- Their itineraries zigzag across the city wasting 1–2 hours of travel per day
- Places are closed when they arrive (the Met is closed Wednesdays; most people find out after)
- Lunch "wherever" becomes an expensive afterthought

**NYC gets 65 million visitors per year.** Most of them plan their trip the same broken way.

---

## The Solution

Roam NYC takes one sentence — *"A relaxed Saturday in Manhattan with my parents, a skyline view, and good pizza. Avoid big crowds."* — and produces a complete, timed, optimized itinerary:

- **Ordered by travel efficiency** — the stops in the sequence that minimizes total travel time
- **Timed to the quiet hours** — using MTA subway ridership data to know when each area is least crowded
- **Validated against opening hours** — it won't put you at the Met on a Wednesday
- **Routed on real streets** — OSRM on OpenStreetMap draws your exact path on the map
- **Continuously adjustable** — chat with it, swap alternatives, change the day, re-plan from now if you're mid-trip

---

## What's Built (Demo-Ready Features)

### Core Planning Engine
- [x] Natural language → plan via Google Gemini
- [x] Combinatorial order optimizer (branch-and-bound, exact for up to ~8 stops)
- [x] Crowd avoidance using preprocessed MTA Subway Hourly Ridership data
- [x] Real street routing via OSRM (walk, bike, car)
- [x] Subway routing with station names and line codes
- [x] Opening hours enforcement (40+ attractions, all hand-geocoded)
- [x] Meal break planning (lunch + dinner, finds nearby food)
- [x] Fixed-time stops (tickets, shows, ferries)

### AI Features
- [x] Free-text plan creation from the landing page and in-planner prompt
- [x] Vague wish resolution with 2–4 alternatives ("a skyline view" → Top of the Rock + 3 alternatives)
- [x] Choices panel: compare alternatives with live plan re-evaluation
- [x] In-plan AI chat (TripChat): "make it end at 7pm", "add something outdoors"
- [x] Traveler profile extraction: pace, group type, interests, walk tolerance

### Map & Visualization
- [x] MapLibre GL map with OpenFreeMap tiles (no Google Maps cost)
- [x] 40+ curated place dots, color-coded by category
- [x] Routed leg lines per travel mode
- [x] Day playback: animated route through the itinerary
- [x] Per-stop 24-hour crowd bar charts
- [x] Place photos (catalog + live lookup)

### User Experience
- [x] Fully responsive: desktop split-pane + mobile bottom sheet
- [x] Shareable plan URLs (plan encoded in URL parameter)
- [x] Save plans to device (localStorage)
- [x] Calendar export (.ics)
- [x] 16-day weather forecast with day picker
- [x] "Re-plan from now" for mid-trip adjustments
- [x] Discover tab: find new places that fit gaps in the current plan
- [x] Quick-start prompts (first timers, downtown day, slower day)

---

## What Makes Roam Different

### Competitors

| | Roam NYC | Google Maps | TripAdvisor | Wanderlog |
|---|---|---|---|---|
| Natural language input | ✅ | Partial | ❌ | Partial |
| Crowd-aware scheduling | ✅ (MTA data) | ✅ (Popular times) | ❌ | ❌ |
| Opening-hours enforcement | ✅ | Manual | Manual | Manual |
| Route optimization | ✅ (exact) | Approx. | ❌ | Basic |
| Real routing (walk/subway) | ✅ | ✅ | ❌ | ❌ |
| Free to use (no key needed for core) | ✅ | ❌ (Maps API $$) | ✅ | Freemium |
| Shareable + no login | ✅ | ❌ | ❌ | ❌ |

### The Key Differentiators

**1. Crowd data is real, not vague.**  
Google Maps shows a "Popular times" bar chart. We use MTA Subway Hourly Ridership — the actual number of people tapping in at every station, every hour, by weekday — and turn it into a weighted crowd level for each attraction's neighborhood. The optimizer uses this as a weighted cost, not a post-hoc label.

**2. The optimizer is exact, not greedy.**  
We run depth-first search with branch-and-bound pruning. For a typical 4–6 stop day, we check every possible order and prove optimality. For larger days, we switch to improvement heuristics. Competitors either ignore order or use a simple nearest-next greedy. The insight strip shows users exactly what they saved.

**3. It's built entirely on open data.**  
No Google Maps API. No proprietary data. MTA open data + OpenStreetMap + OSRM + Nominatim + OpenFreeMap. The only paid service is Gemini for the AI step — and the app works in browse/manual mode with no API key.

**4. It's genuinely conversational.**  
TripChat doesn't just surface options — it re-runs the full optimizer pipeline with the user's request as natural language context, so "add something outdoors after the Met" produces a new valid, timed, crowd-aware plan, not just a suggestion.

---

## Demo Script (3–5 minute pitch)

### 1. Open the landing page (30 sec)
"Most people plan their New York trip like this — 6 browser tabs, no idea what's closed, no idea how long it takes to get from A to B. We think there's a better way."

Point at the ambient map background and the sample itinerary card.

"Roam takes one sentence and turns it into a full day."

### 2. Type a prompt and submit (45 sec)
Type: *"Saturday with my partner. A museum, one great view, walk across the Brooklyn Bridge, and good pizza for lunch. Avoid big crowds."*

Hit "Build my day." Show the thinking state.

### 3. Show the plan (90 sec)
"Look what happened. The Met first — at 9am, when the area is at 40% of its peak busyness. We visit before the crowds. Then the Brooklyn Bridge, naturally nearby. Then Top of the Rock for the view in the afternoon. Pizza fits in here as a lunch break, and Roam found a spot near where the day already is."

Point at the **insights strip**: "This order saves 18 minutes of travel versus the order I typed them."

Click a stop to open the PlaceSheet. Show the crowd chart. "This is real MTA ridership data — not a vague 'busy' label. You can see exactly when to go."

### 4. Show Choices (45 sec)
Point at the Choices panel. "I said 'a view' — the assistant picked Top of the Rock but offers three alternatives. Watch what happens when I switch to the Empire State Building."

Click an alternative. Plan re-runs. "The whole day updates in real time. Different time, different cost, different crowd level."

### 5. Show TripChat (30 sec)
"Now I'm in the plan. I want to adjust it — let's chat." Type: *"Can it end by 7pm?"*

Show the updated plan. "Done. The day is re-optimized around the new end time."

### 6. Share + Export (30 sec)
Click Share. "I can send this link to my partner — they open it, it re-runs the plan for that day, and they can adjust from there. No account, no sign-up. Or I can export to my calendar."

---

## Impact & Scale

- **Target users:** 65M annual NYC visitors + locals planning days out
- **Cost to serve:** Near-zero for the free tiers. One Gemini API call per plan built (~$0.0003 per plan at current pricing)
- **Scale path:** Expand to other cities (same architecture, different attraction catalog + crowd data source)
- **Monetization options:** Premium features (group planning, multi-day trips, offline mode), partnerships with attraction booking platforms, white-label for hotel concierge apps

---

## Technical Choices (Judges' Q&A)

**Why Gemini instead of GPT-4?**  
`gemini-3.5-flash-lite` is significantly cheaper and faster for structured JSON extraction tasks like this — we use `responseMimeType: "application/json"` + a JSON schema so the model output is directly typed, no parsing fragility.

**Why OSRM instead of Google Maps Directions?**  
Google Maps Directions API costs ~$5 per 1,000 requests and requires a billing account. OSRM is free, open, and actually more transparent — we can see exactly what routing profile is being used and why a route was chosen.

**Why MTA data instead of venue-level foot traffic?**  
Venue-level crowd data (e.g., from Foursquare or Placer.ai) is expensive and doesn't cover all attractions. MTA ridership is free, open, high-quality, and covers every neighborhood in NYC — it's an excellent proxy for area busyness, and we label it as such.

**Why no login?**  
The biggest friction in consumer apps is the signup wall. A plan is just a URL. You can share it, bookmark it, open it on another device. We earn trust before asking for anything.

**How does the optimizer scale?**  
For ≤ ~8 stops (the typical day), we find the exact optimum. Beyond that, a 2M-node budget with greedy seeding + insertion improvement keeps it fast. A typical 5-stop plan solves in < 10ms server-side.

---

## Hackathon Context

**Built for:** DivHacks 2026  
**Team:** Roam NYC  
**Stack:** Next.js 16 + React 19 + Gemini + MapLibre GL + OSRM + MTA Open Data  
**Time to build:** Hackathon sprint  
**Lines of original logic:** ~4,000 (excluding UI primitives and generated types)

### What we're proud of
- The optimizer is genuinely rigorous. Depth-first search with tight lower bounds is not the easy solution — but it means "this is the best possible order" is a true statement.
- Every data source is open. This isn't a demo powered by expensive private APIs — it could run at meaningful scale for nearly nothing.
- The UX is production-quality on both desktop and mobile. The bottom-sheet drag, the panel resize, the playback animation — these aren't afterthoughts.

### What's next
- Multi-city support (same architecture, different catalog JSON)
- Multi-day trip planning
- Live transit data (MTA real-time feeds for actual departure times)
- Collaborative planning (multiple people editing a shared plan)
- Offline mode for use while walking around the city
