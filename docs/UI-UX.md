# Roam NYC — UI/UX Design Documentation

## Design Philosophy

Roam NYC is built around one core insight: **planning a day in a new city is cognitively expensive.** The typical approach is a browser tab graveyard — Google Maps here, TripAdvisor there, guessing at timing, ignoring crowds. Roam removes that friction entirely. The interface asks only what the user actually knows ("what I want to see"), handles everything they don't (order, timing, travel, crowds), and gets out of the way.

The UX hierarchy:
1. **Say what you want.** One natural-language prompt does everything.
2. **See the result immediately.** A timed itinerary on a map, no form-filling.
3. **Adjust freely.** Swap places, change the day, chat with the AI.

---

## Pages

### Landing Page (`/`)

**Goal:** Communicate the product's value in under 10 seconds and get users into the planner.

**Layout:** Full-screen hero. Left half: headline + prompt bar. Right half: a live MapLibre GL map of NYC as the background (not a static image — it moves, reinforcing that this is a real mapping product). A glassmorphism gradient fades the map to the left so the type stays readable.

**Hero headline:** *"See New York, not the crowds."* — names the core differentiator immediately, not the product category.

**Prompt bar on the landing:** A single input. Submitting it navigates to `/plan?q=...` which auto-runs the AI. There is no "sign up" gate.

**Sample itinerary card:** A hardcoded preview ("Central Park → The Met → Top of the Rock → Chelsea Market") with crowd badges and a "saves 1h 17m of travel" note. This concretizes the pitch before the user has typed anything.

**Features section ("A day planned like a local would plan it"):** Four feature tiles with icons, plain-English descriptions. No jargon. Each tile explains *what the user gets*, not how it works.

**Footer:** Attribution for all open data sources. Transparency about what crowd levels mean ("the area around a place, not the line inside it").

---

### Planner Page (`/plan`)

This is the main application. It is a **split-pane layout** on desktop and a **bottom-sheet layout** on mobile.

---

## Desktop Layout (≥1024px)

```
┌─────────────────────┬───┬──────────────────────────────────┐
│   Side Panel        │   │                                  │
│   (resizable,       │ ↕ │         MapLibre GL Map          │
│   360–720px)        │   │                                  │
│                     │   │  • Place dots w/ photos          │
│  [Build / Itinerary]│   │  • Routed leg lines              │
│   tabs              │   │  • Day playback scrubber         │
│                     │   │  • Origin marker                 │
│  ─────────────────  │   │                                  │
│  Content area       │   │                                  │
│  (scrollable)       │   │                                  │
└─────────────────────┴───┴──────────────────────────────────┘
```

The panel divider is draggable (360–720px range), keyboard accessible (arrow keys), and has a visual affordance (expands on hover/focus).

The panel's sticky header shows:
- The Roam logo
- A **Build / Itinerary** segmented toggle (shown only after a plan exists)

---

## Mobile Layout (<1024px)

The map is full-screen. The panel is a **bottom sheet** with three snap heights:
- **Peek (150px + footer):** Just the collapsed summary line or TripChat composer. The map is nearly fully visible.
- **Half (~52% viewport):** Default after planning. Shows the top of the itinerary over the map.
- **Full (viewport − 72px):** Full panel, map barely visible.

The sheet handle bar is draggable (pointer events) and tappable (cycles peek → half → full). This mirrors iOS Maps / Google Maps native patterns.

**On mobile, the sheet auto-snaps:**
- After a new plan: → half
- When the playback starts: → peek (user watches the map)
- When the user types in TripChat: → at least half

---

## Build View

Shown before a plan exists, or when the user switches the toggle back to "Build."

### AI Prompt Section

```
┌─────────────────────────────────────────────────┐
│ A better way around New York                    │  ← eyebrow text
│ Make a day of it.                               │  ← heading
│ Choose what you want to see...                  │  ← subtext
│                                                 │
│ [First time in NYC] [Downtown day] [A slower day]│  ← quick-start chips
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │  What would make this a great NYC day?      │ │
│ │  (textarea, 3 rows, 1500 char limit)        │ │
│ │                                             │ │
│ │           [✨ Build my day →]               │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Assistant reply bubble]                        │
└─────────────────────────────────────────────────┘
```

The textarea focuses on arrival with a prompt from the landing page. The "Build my day" button is disabled until 3 characters are typed and while thinking. The assistant's reply (from Gemini) appears in a brand-colored bubble below, explaining what it picked for vague requests.

**Quick-start chips** offer three pre-written prompts for users who don't know what to type. Each one models good input format (specifying day, places, transport, crowd preference).

### Saved Plans

If the user has previously saved plans in `localStorage`, they appear here as a compact list (up to 5). Each has a title ("Sat, Sep 26 · The Met, MoMA +2") and a delete button.

### Trip Details (collapsible)

An accordion section with a one-line summary ("Today · 9am–9pm · Subway + walk · Avoid crowds") that expands to reveal:
- Date picker
- Transport mode (subway+walk / walk / bike / car) — segmented control
- Crowd preference (avoid / balance / okay) — segmented control
- Start and end time — native time inputs
- Food breaks (lunch, dinner) — checkboxes
- Starting point — address input with geocoding
- Return to start — checkbox (shown when origin is set)
- **Traveler profile (ProfileCard):** pace, group, interests, max walk

The collapsed state updates to reflect current settings so the user can see their configuration at a glance without expanding.

### Browse Places (StopPicker)

A scrollable catalog of 40+ attractions, grouped by category (museums, views, landmarks, parks, food, neighborhoods). Each tile shows name, area, category color, and visit time. Tapping adds it to the stop list or inspects it. The map dots correspond 1:1 — tapping a map dot opens the same inspection sheet.

A "suggestions" row at the top shows places the traveler profile predicts the user would enjoy, filtered to the chosen day of week.

---

## Itinerary View

The core of the planned day.

### Stop Cards

Each stop has:
- **Number badge** and **place photo** (catalog photo or live Google Places photo)
- Name, area, arrival time, visit duration, departure time
- **Crowd bar** — a 24-hour sparkline-style bar chart in the stop's category color, with a vertical cursor at the visit time. The band label ("Quiet", "Moderate", "Busy", "Peak time") is color-coded.
- **Leg indicator** — how you got here (walk, subway, bike, car), estimated minutes, and for subway: line badges (e.g., ① ②) and station names.
- **Hours/issues badge** — if the stop has an opening-hours conflict, a warning chip appears.

Active stop (the one currently visible on the map) gets a highlighted left border.

### Day Playback

The map has a playback scrubber that animates the route through the day in real time. The current position is shown as a moving marker. The corresponding stop card in the panel scrolls into view as the animation passes it. On mobile, the sheet snaps to Peek when playback starts so the user can watch the map.

### Insights Strip

A horizontal scroll row of AI-generated insights:
- "This order saves 22 min of travel vs. the order you added them."
- "The Met at 9 am: the area is about 40% as busy as at 3 pm, its busiest hour that day."
- "Subway times are estimates from station distances. Leave a few minutes of slack."

These are the planner's reasoning made visible. They build trust and teach the user what the system is doing.

### Choices Panel (ChoicePanel)

When the AI resolved a vague wish ("a skyline view") or when a meal break has nearby options, a Choices strip appears above the itinerary. Each choice has 2–4 option cards. Selecting one replans the day in place. Each card shows:
- Place photo and name
- Start time if selected
- **Compare badge** — how this option changes the day vs. the current choice: "+8 min travel" or "Busy at 2pm" or "Closes early"

This is the "slot machine" moment of the product — users try alternatives and see the plan update live.

### Day Picker (DayPicker)

A horizontal scroll of the next 16 days with weather icons. Tapping a day reruns the plan with the same stops on the new date. Weather icons (clear, cloudy, rain, snow) are color-coded. The current date is highlighted.

### TripChat

A compact AI chat composer pinned to the bottom of the itinerary panel. The user can say:
- "Make it end at 7pm"
- "Swap something outdoors for the afternoon"
- "We're with kids — adjust the pace"

The assistant replans in place and replies with a brief explanation. The conversation persists while the user toggles between Build and Itinerary views.

### Action Buttons

At the bottom of the itinerary:
- **Save** (bookmark icon) — saves the plan code to `localStorage` with a date-and-stops title
- **Share** (link icon) — copies a shareable URL to clipboard
- **Export to calendar** (calendar icon) — downloads a `.ics` file with each stop as a timed event

### Re-plan for Now (NextUp)

If the plan date is today, a "NextUp" bar shows at the top of the itinerary:
- The current or next stop
- Minutes until you should leave
- A "Re-plan from now" button that opens a dialog to drop already-visited stops and re-plan the remaining day from the current time

---

## PlaceSheet (Map Popover)

Tapping a map marker or a stop card opens a bottom-anchored sheet with:
- Place photo
- Name, area, blurb
- Opening hours for the chosen day
- Crowd chart (24h sparkline)
- Visit duration picker (15, 30, 45 min…)
- Add/Remove button (or the planned time if in the itinerary)
- "View on map" button

---

## Map Design

**Base map:** OpenFreeMap tiles, light style in light mode, dark style in dark mode.

**Place markers:**
- In Browse mode: color-coded dots by category (parks = green, museums = purple, views = blue, etc.)
- In Plan mode: numbered white circles on a dark background (1, 2, 3…) with photo thumbnails on hover

**Leg lines:**
- Walk: dashed, neutral gray
- Subway: solid, brand blue
- Bike: dashed, green
- Car: solid, amber

Each leg animates in on plan load (MapLibre interpolation).

**Origin marker:** A home icon.

---

## Color System

The UI uses CSS custom properties defined on `:root` so light/dark mode works at the theme level:

| Token | Use |
|---|---|
| `--brand` | Primary accent (plan button, active elements) |
| `--brand-soft` | Brand tint background (badges, chips) |
| `--cat-parks` | Park/outdoor category color |
| `--cat-nightlife` | Museum category color |
| `--cat-restaurants` | Food category color |
| `--cat-subway` | View / transit color |
| `--sev-b` | Moderate crowd |
| `--sev-c` | Busy / error states |

The palette is designed to work at small sizes (map dots, 2px legend lines) without relying on hue alone — each band also has a label.

---

## Typography

Two typefaces:
- **Display font** (`font-display`): used for headings, the logo, the hero H1, and card numbers — a distinctive, slightly editorial feel
- **System font stack**: body, labels, metadata — legible at 11px

---

## Accessibility

- All interactive map markers are keyboard accessible (tab + enter)
- The panel resize handle has `role="separator"` with `aria-valuemin/max/now` and responds to arrow keys
- Sheet collapse/expand button has `aria-label` ("Collapse the panel")
- Live regions (`aria-live="polite"`) for assistant replies and error messages
- Crowd charts have color labels (not color-only)
- All icon-only buttons have `aria-label`
- Native `<input type="time">` and `<input type="date">` for time/date pickers (avoids custom widget accessibility overhead)

---

## Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| < 640px | Single column, bottom sheet, compact type scale |
| 640–1023px | Single column, bottom sheet, wider content |
| ≥ 1024px | Split pane (panel + map), full-height |

---

## Empty States and Loading

- **No stops added:** The map shows the full NYC catalog. The panel shows the prompt and browse sections.
- **Planning spinner:** A full-width branded loading bar in the panel header. The button becomes "Finding the best order…" with a spinner.
- **Re-planning (stale):** A sticky banner ("You changed your stops or settings. [Re-plan]") replaces the spinner for incremental edits after a plan exists.
- **Skeleton loaders:** The map loads as a skeleton while MapLibre hydrates client-side.
- **Photo fallbacks:** Places without photos show a gradient placeholder in the stop card's category color.

---

## Key UX Decisions

**Why no login?**  
Every plan is stateless and shareable via URL. Saved plans live in `localStorage`. This eliminates the biggest conversion hurdle for a hackathon-timescale product, and it's honest — you don't need an account to plan a trip.

**Why does the landing prompt auto-run on arrival?**  
If a user types their trip on the landing page and clicks the button, they expect to see their plan — not a blank planner. The URL carries the query and the plan page runs it immediately on mount.

**Why does replanning happen in-place?**  
Every itinerary change (pick a different date, swap an alternative, add a stop from the chat) calls the optimizer server-side and replaces the current plan without a page navigation. The URL is rewritten silently. This makes the product feel live, not form-like.

**Why are crowd levels relative to the day, not the week?**  
Normalizing against the week's peak would make every Saturday afternoon look "quiet" compared to a Tuesday rush-hour commute. A visitor wants to know "is this busy for a Saturday?" The chart answers that question.
