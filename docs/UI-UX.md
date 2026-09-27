# PlaNYt — UI/UX Guide

## Design Principles

- **Reduce friction:** Answer questions the app can, let users focus on what only they know
- **Explanations over mystery:** Every choice is explainable—travel time saved, crowd timing, why a stop was skipped
- **No account wall:** Solo plans live in browser storage; group trips share via URL (no login required to view)
- **Mobile-first:** Works on phone as well as desktop for on-the-go re-planning

## Landing Page (`/`)

**Style:** Editorial New York—cream (light) and charcoal (dark), serif headlines, newsreader body, monospace labels. Styles live in `src/app/home.css`, typography in `src/app/editorial.css`, scoped under `.ed` class.

**Components:**
1. **HeroStage** — 3D hero using Google's photorealistic Manhattan. User flows through a letter into the city and lands at the Empire State Building. Submits prompt to `/plan?q=...` which auto-runs the planner.
2. **PlanDemo** — Self-typing prompt builds an example itinerary while the route animates on a 3D map. Cycles through three example days every 60s.
3. **NeighborhoodStory** — Scrollytelling section with pinned 3D map that flies to each of eight NYC neighborhoods. Each has an outlined Roman numeral, vibe description, and suggested stops.
4. **Colophon** — Closing section with three ruled columns (sections, sources, data attribution), baseline with "Back to top" button.

**Interactive details:**
- Theme toggle (top-right) reveals the new theme as a circle spreading from the button
- Hero journey shortcuts flip like a flip clock through nine presets (one every 4.5s)
- Reduced-motion: skips 3D animations, starts landed
- Lite devices: skips 3D, serves static hero

## Planner Page (`/plan`)

Solo itinerary building and map exploration.

### Desktop (≥1024px)

```
┌─────────────────────┬───┬──────────────────────────────────┐
│   Side Panel        │   │                                  │
│   (resizable)       │ ↕ │    Google 3D / MapLibre GL      │
│   360–720px         │   │                                  │
│                     │   │  • Place dots (numbered)         │
│  [Build/Itinerary]  │   │  • Routed legs per mode          │
│  tab                │   │  • Day scrubber (playback)       │
│                     │   │  • Origin marker                 │
│  ────────────────   │   │  • Crowd heatmap (optional)      │
│  Content (scroll)   │   │                                  │
└─────────────────────┴───┴──────────────────────────────────┘
```

The panel is draggable at the divider (360–720px range, keyboard accessible).

### Mobile (<1024px)

Full-screen map with a **bottom sheet**:
- **Peek** (150px + footer): Collapsed summary or TripChat input. Map mostly visible.
- **Half** (~52%): Default after planning. Itinerary visible.
- **Full** (viewport − 72px): Full panel, map barely visible.

Sheet handle is draggable and tappable (cycles peek → half → full). Auto-snaps: after planning → half; playback → peek; typing → at least half.

## Build View

**AI Prompt**
```
┌─────────────────────────────────────────────────┐
│ Eyebrow text                                    │
│ Make a day of it.                    │ [🌙 Dark]│  ← theme toggle
│ Choose what you want to see...                  │
│                                                 │
│ [Friend] [Downtown] [Slow]                      │  ← quick-start chips
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │  What would make this a great NYC day?      │ │
│ │  (textarea, 3 rows, 1500 char limit)        │ │
│ │                                             │ │
│ │           [✨ Build my day →]               │ │  ← loading state
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Gemini reply]                                  │  ← intent confirmation
└─────────────────────────────────────────────────┘
```

Textarea has keyboard focus on arrival. "Build my day" is disabled until ≥3 chars and while thinking. Gemini reply shows in a brand-colored bubble.

**Trip Details** (collapsible accordion):
- Date picker
- Transport mode (subway+walk / walk / bike / car)
- Crowd preference (avoid / balanced / okay)
- Start/end time
- Food breaks (lunch, dinner)
- Starting point (address input with geocoding)
- Return to start (checkbox)
- Traveler profile: pace, group, interests, max walk

**Browse Places** (StopPicker):
- 40+ curated attractions, grouped by category (museums, views, parks, food, neighborhoods)
- Each shows name, area, category color, visit duration
- "Suggestions" row (profile-predicted favorites)
- Tapping adds to stop list or opens inspection sheet

## Itinerary View

The planned day.

**Stop Cards**
- Number badge, photo (catalog or live)
- Name, area, arrival/departure times, visit duration
- **Crowd bar** — 24h sparkline in category color with visit-time cursor
- **Leg indicator** — mode (walk/subway/bike/car), minutes, subway line badges and stations
- **Hours/issues badge** — warning if closed or conflict
- Active stop gets a highlighted left border

**Playback** — Animate the route minute-by-minute through the day. Current position shown as moving marker. Mobile sheet snaps to Peek so map is visible.

**Insights Strip** — Horizontal scroll of AI-generated explanations:
- "This order saves 22 min vs. the order you added them"
- "The Met at 9am: the area is about 40% as busy as at 3pm"
- "Subway times are estimates; follow the Google Maps link for live schedules"

**Choices Panel** — When vague wishes ("a skyline view") resolve to 2–4 alternatives or meals have nearby options:
- Each choice card shows photo, name, time (if selected), comparison badge ("−8 min travel", "Busy at 2pm", "Closes early")
- Selecting one re-plans the day in place

**Day Picker** — Horizontal scroll of next 16 days. Weather icons (clear, cloudy, rain, snow). Tap to re-plan same stops on a new date.

**TripChat** — Pinned composer at the bottom. Ask things like "make it end at 7pm", "swap something outdoors for the afternoon", "we're with kids—adjust". The assistant re-plans in place and replies briefly.

**Action Buttons**
- Save (bookmark) — saves to localStorage with a title
- Share (link) — copies shareable URL to clipboard
- Export (calendar) — downloads .ics with each stop as a timed event

**NextUp** (if plan date is today) — Shows current or next stop, minutes until departure, "Re-plan from here" button (drops visited stops, re-plans rest from current time).

## Place Sheet

Tap a map marker or stop card to open a bottom sheet with:
- Photo
- Name, area, blurb
- Hours for the chosen day
- 24h crowd chart
- Visit duration picker (15, 30, 45 min…)
- Add/Remove button (or "Planned: 10am–11am" if already in itinerary)
- "View on map" button

## Group Trip Page (`/trip/[id]`)

**Real-time voting room** where members vote on stops and PlaNYt re-optimizes as votes roll in.

**Sections**
1. **Trip header** — Title, members list, "Invite" button (copies link)
2. **Suggested stops** — Members can propose places (search, browse, or chat). Each gets upvote/downvote buttons
3. **Candidates** — PlaNYt generates 2–3 candidate itineraries from the current votes. Click to preview
4. **Approval flow** — Once a candidate is chosen: members approve (checkmark), creator confirms (launches the final itinerary)
5. **Final itinerary** — Same as solo planner (stops, times, legs, crowd data)
6. **Group chat** — Conversational adjustments ("add something outdoor", "earlier end time") with voting/confirmation

## Map Design

**Landing (3D):** Google's photorealistic 3D Manhattan, animated camera, reduced-motion fallback.

**Planner:** 
- Google 3D (if enabled) or MapLibre GL (OSM-based, free)
- Place markers: numbered circles (1, 2, 3) with photo thumbnails on hover
- Leg lines: dashed (walk), solid (subway/car), green (bike), gray fallback
- Origin: home icon
- Animations: legs animate in on plan load (MapLibre interpolation)

**Neighborhoods (3D):** Google 3D map pinned to viewport; camera flies between eight neighborhoods during scrollytelling.

## Colors & Typography

**Color tokens** (CSS custom properties, light/dark support):
- `--brand` — primary accent
- `--brand-soft` — tinted backgrounds
- Category colors (parks, museums, views, food, etc.)
- Crowd severity (quiet, moderate, busy, peak)

**Fonts:**
- **Display:** Instrument Serif (headlines, logo, numbers)
- **Body:** Newsreader (editorial); sans-serif system stack (planner)
- **Mono:** IBM Plex Mono (labels, API, credits)

## Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| <640px | Single column, bottom sheet, compact type |
| 640–1023px | Single column, bottom sheet, medium type |
| ≥1024px | Split pane (panel + map), full-height |

## Accessibility

- All interactive elements (map markers, buttons, inputs) are keyboard accessible
- Focus outlines explicit and high-contrast
- Live regions (`aria-live`) for plan updates and errors
- Crowd charts have text labels, not color-only
- Icon-only buttons have `aria-label`
- Native `<input type="date">` and `<input type="time">` (no custom widgets)
- Reduced-motion media query (no 3D on landing if enabled, no animations on planner)
- Theme toggle labeled and keyboard accessible
- iMessage and web speech I/O support screen readers (tested with NVDA, VoiceOver)

## Empty States & Loading

- **No stops:** Map shows NYC catalog. Panel shows prompt and browse sections.
- **Planning:** Full-width branded loading bar in panel header. Button shows "Finding the best order…"
- **Re-planning:** Sticky banner ("You changed stops or settings. [Re-plan]") after incremental edits.
- **Skeleton loaders:** Map skeleton while Google/MapLibre loads.
- **Photo fallbacks:** Gradient placeholder in stop card's category color.
