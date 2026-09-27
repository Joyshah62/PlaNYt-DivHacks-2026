# Roam Design System: "Editorial × 3D Manhattan"

The home page (`/`) is the reference implementation of this system. Every new page, including the
redesign of the planner (`/plan`), should read like another page of the same magazine. This
document is the handoff: what the system is, where it lives in code, and how to extend it.

> Status (2026-09-26): the home page and the planner (`/plan`) are both in this system. The
> planner's styles are `src/app/plan/planner.css` (`.pl-*`, scoped under `.ed-planner`); the old
> glass-neumorphic `.neo-*` layer and its fonts are gone. The planner is AI-first: Build is the
> prompt (date, hours, company, pace and start point are read from what people type; there are no
> manual settings), with "Pick places yourself" as a quiet alternative that collects places in a
> tray with Undo. Your day = photo cover → "Ask the planner to change anything" → Save / Share ▾ /
> Edit stops → the timeline → folded "Your call", "The best day", "Why this order". The assistant
> sits in the map's bottom-right corner; it opens on click, tap or Enter and closes on ×, Escape
> or a click in the column (clicks on the map leave it open). Map tools: zoom and locate, with
> north-up, 3D and layers behind "More"; the place filter shows only while picking places.

---

## 1. The idea

A New York print magazine, with Google's photorealistic 3D city as its photography.

- **Paper and ink.** Cream paper, near-black ink, one editorial red. No gradients on surfaces, no
  glass, no rounded cards, no drop-shadow blur. Depth comes from rules, type and the map.
- **The map is the picture.** Where a magazine would run a photo, we run the live 3D city,
  captioned like a plate ("Plate I · Midtown Manhattan, live").
- **Typography does the work.** Big serif headlines, a readable text serif, uppercase mono labels.
- **Motion is cinematic but rare.** One big moment per section (the intro dive, the self-playing
  plan, the camera flights), slow orbits, and nothing that moves off screen.
- **Full canvas.** Pages use the whole viewport with equal gutters; never a narrow centred box.

## 2. Where it lives

| File | What |
|---|---|
| `src/app/home.css` | All tokens and styles, scoped under `.ed` (see §8 for promoting them) |
| `src/components/home/fonts.ts` | The three `next/font` families → `edFonts` class string |
| `src/components/home/data.ts` | All copy, links and camera positions for the home page; `ORBIT_SECONDS` |
| `src/components/home/HeroStage.tsx` | Hero + intro choreography |
| `src/components/home/PlanDemo.tsx` | "Watch it plan" self-playing demo (cycles through `DEMOS`) |
| `src/components/home/PresetFlip.tsx` | The hero's split-flap shortcuts (cycles through `PRESETS`) |
| `src/components/home/NeighborhoodStory.tsx` | Scrollytelling chapters over a pinned map |
| `src/components/home/Colophon.tsx` | Footer |
| `src/components/home/cityMap*.ts`, `useCityMap.ts` | The map abstraction (§6) |
| `src/components/home/visibility.ts` | `useInView`, `usePageVisible`, `usePrefersReducedMotion` |
| `src/components/theme/ThemeToggle.tsx` | Shared toggle with the circular theme reveal |
| `docs/superpowers/specs/2026-09-26-home-editorial-3d-design.md` | The approved spec |

## 3. Tokens

All tokens are CSS custom properties on `.ed`; `.dark .ed` swaps the colours ("Evening edition").

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#f3ede1` | `#1a1815` | Page background |
| `--ink` | `#15120e` | `#efe8da` | Text, rules, primary buttons |
| `--muted` | `#6d6457` | `#a39a8b` | Secondary text, captions |
| `--rule` | `var(--ink)` | `rgba(239,232,218,.35)` | 1px rules, 3px double section rules |
| `--red` | `#c8321f` | `#e0543f` | The one accent: kickers, route bullets, active states. Never for large areas |
| `--field` / `--field-ink` | `#fffdf8` / `#15120e` | `#24201b` / `#efe8da` | Inputs and prompt boxes |
| `--shadow` | `#15120e` | `rgba(239,232,218,.16)` | The hard offset shadow |
| `--night` | `#1c1a17` | same | Behind maps while they load |
| `--on-map` | `#f3ede1` | same | Any text or chrome over the map (always light, in both themes) |

### Type (fluid: minimum at phones, maximum at large monitors)

| Token | Range | Use |
|---|---|---|
| `--t-mono` | 10 → 14px | Uppercase labels, buttons, kickers (`.ed-mono`) |
| `--t-small` | 13 → 17px | Captions, reasons, credits |
| `--t-body` | 16 → 22px | Body text (the `.ed` default) |
| `--t-lead` | 16 → 24px | Prompt text, list items, row names |
| `--t-wordmark` | 24 → 44px | The "Roam" wordmark in headers |
| Headlines | `clamp(40px, 4.6vw, 104px)` (`.ed-h2`) | Section titles; hero and chapter titles are larger |

Families: **Instrument Serif** 400 roman + italic (`--f-display`: headlines, wordmark),
**Newsreader** 400/600 + italic (`--f-text`: body), **IBM Plex Mono** 400/500 (`--f-mono`: labels,
uppercase, `letter-spacing: .14em`). Pattern for headlines: a roman phrase, then an italic phrase:
"One sentence in. *A whole day out.*"

### Space

`--gut` (16 → 80px) is the page gutter (left = right, always). `--s-1` … `--s-4` (8 → 96px) are the
only spacing values. `--offset` (4 → 8px) is the hard shadow offset.

**Rule: no fixed pixel sizes for type or spacing.** Use the tokens, `em`, or `clamp()`. Grids use
`minmax(min(100%, 340px), …)` so they never overflow a phone. Heights use `dvh`.

## 4. Components (CSS classes)

| Class | What it is |
|---|---|
| `.ed` | Page root: tokens, paper, body type. Put it on `<main>` with `edFonts` |
| `.ed-paper` | Paper grain background (light: dark flecks; dark: light flecks). Only on paper sections, never over a map |
| `.ed-gut` | Page gutters |
| `.ed-display`, `.ed-mono`, `.ed-kicker` | Type roles; kicker = red mono label above a headline |
| `.ed-h2` | Section headline |
| `.ed-btn`, `.ed-btn--ghost` | Square, mono, uppercase buttons (ink fill / outline) |
| `.ed-prompt` | The prompt box: field, ink border, hard offset shadow, red shadow on focus |
| `.ed-chips`, `.ed-flip` | Italic underlined text links; in the hero they flip like a split-flap board |
| `.ed-bullet` | Red numbered route bullet (①②③): stop numbers everywhere |
| `.ed-row`, `.ed-crowd` | Itinerary row (bullet, time, name + reason, crowd bars with the chosen hour in red) |
| `.ed-callout` | Paper card over a map with the offset shadow ("44 min less travel") |
| `.ed-chapter` | Scrollytelling chapter with an outlined Roman numeral behind it |
| `.ed-colophon-*` | Footer: closing line + button, three ruled columns, baseline |

Section structure: sections are separated by a **3px double rule** (`border-top: 3px double
var(--rule)`); inside, 1px rules. Map panels sit flush to the rule with a 1px `--rule` border.

## 5. Motion

- **Only `transform` and `opacity` animate.** Per-frame work goes to the DOM through refs, never
  through React state.
- **The intro** (HeroStage): the page is blank paper until the 3D city has painted; "New York"
  rises letter by letter with the city inside the letters (two blended layers: `ed-knock--cut`
  lighten + `ed-knock--paper` multiply, exact in both themes); after 2.3s the page dives into the
  thickest letter stroke (`diveOrigin.ts`) while the camera descends onto the Empire State
  Building; the headline re-sets; the map orbits. Plays on every load; skipped (landed) for
  reduced motion and lite devices.
- **Orbits:** every map that circles a landmark uses `ORBIT_SECONDS` (360s per turn, ~1°/s).
- **Loops only when watched:** the plan demo plays the next of three example plans 60s after
  finishing, only while it's on screen and the tab is visible. The hero's shortcuts flip one slot
  every 4.5s like a flip clock (nine presets, three on show): the old label tips back and falls
  away over 0.55s, the new one swings down and settles with a small bounce over 0.9s. Pauses on
  hover/focus and off screen.
- **Theme switch:** the new theme spreads from the toggle as a circle (View Transitions, 750ms).
- **Reduced motion:** no intro, no orbits, demo shows its final state, theme switches instantly.

## 6. Maps

Components never touch Google or MapLibre directly; they use the `CityMap` interface
(`cityMap.ts`): `jumpTo`, `flyTo`, `orbit`, `stop`, `onMove`, `setRoute`, `addPin`,
`clearOverlays`, `destroy`, created through `useCityMap(hostRef, camera, role, enabled)`.

- **Engines:** Google photorealistic 3D (`cityMapGoogle.ts`, Maps JS channel `beta`: `alpha` breaks
  overlays) by default; MapLibre flat satellite (`cityMapLibre.ts`) as the fallback when there's no
  key, Google fails (auth, `gmp-error`), or on lite devices for secondary maps. No WebGL → no map.
- **Engine key:** `NEXT_PUBLIC_MAP_ENGINE` = `maplibre` (free; use in `.env.local` for everyday
  development) or `google` (3D everywhere, including lite devices; use for demos and hosting).
  Unset = automatic (Google when a key is set; MapLibre for secondary maps on lite devices).
  `NEXT_PUBLIC_*` values are baked in at build time, so a local `npm run build` also picks up
  `.env.local`: set it to `google` before building a Google 3D demo build.
- **Cost rules:** each Google 3D map load is billed (10,000 free/month). Create maps only near the
  viewport (`useInView(..., { once: true })`), never destroy/recreate on scroll, stop animations
  off screen and in hidden tabs. A visitor who stays in the hero costs one load.
- **Cameras** are `{ lat, lng, alt, range, tilt, heading }` (Google's model); MapLibre converts
  with `rangeToZoom` and caps tilt (40° zoomed out, 50° otherwise) to avoid a black horizon.
- **Credits must stay visible:** Google's logo, and Esri's credit (collapsed to a small ⓘ).
- **Do not cache Google map content** (Maps Platform terms). The browser's HTTP cache is enough.

## 7. Theming

- Light is the "Morning edition", dark the "Evening edition". Both are first-class: check every
  new component in both.
- Anything over a map is always light text on the map (`--on-map`) with the top/bottom scrims.
- The shared `ThemeToggle` takes `className="ed-theme"` on editorial pages so its icon follows the
  surrounding text colour.

## 8. Building the next pages (handoff)

The full brief for the planner redesign is **`docs/HANDOFF-planner.md`**. In short:


1. **Promote the tokens first.** Split `src/app/home.css` into `src/app/editorial.css` (the `.ed`
   tokens, §3, and the primitives in §4: paper, type roles, buttons, prompt, chips, bullets,
   rows, callout, rules) and `home.css` (hero, demo, story, colophon). Import `editorial.css` from
   the root layout or from each editorial page.
2. **Wrap the page** in `<main className={\`ed ${edFonts}\`}>`, sections separated by double rules,
   content inside `.ed-gut`.
3. **Planner (`/plan`) redesign notes:**
   - Keep the product contract: `/plan?q=…` auto-plans; shared plan links; all API routes.
   - Keep `PlanMap.tsx` (MapLibre with Day/Night/Satellite/Transit layers and Locate Me, per
     `AGENTS.md`); restyle only its chrome (controls as `.ed-btn--ghost`, square, mono).
   - Replace `.neo-*` surfaces (ChoicePanel, Discover, Itinerary, PlaceSheet, TripChat, …) with
     paper panels, 1px rules and `.ed-row`/`.ed-bullet` for stops; the crowd strip becomes
     `.ed-crowd` bars with the chosen hour in red.
   - Side panel on desktop = the paper column; the map = the plate. On mobile keep the bottom
     sheet, styled as a paper sheet with a top rule.
   - When nothing uses `.neo-*` any more, delete those styles from `globals.css`.
4. **Checks for every page:** 375, 768, 1024, 1440, 1920 and 2560px wide with no horizontal
   overflow; light + dark; reduced motion; `npm run lint`, `npm test`, `npm run build`.

## 9. Known issues

- The MapLibre fallback (development engine) shows a jagged band of unloaded satellite tiles on
  the zoomed-out, tilted demo view. Google 3D is unaffected.
- Lighthouse (desktop, GPU enabled): **99 with the MapLibre engine** (2026-09-27: LCP 0.8s, TBT
  40ms, CLS 0.002). With Google 3D it measured **88** (2026-09-26, before the intro started
  holding the letters until the city paints): Google's 3D engine adds blocking time and the
  perpetual orbit penalises Speed Index. Re-measure with Google 3D before quoting a number.
