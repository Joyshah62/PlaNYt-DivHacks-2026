# Home page redesign: "Editorial × 3D Manhattan"

Status: approved in brainstorming (2026-09-26), pending spec review
Reference prototype: `.superpowers/brainstorm/*/content/reel-3d.html` (git-ignored; contains the Maps key)

## Goal

Replace the home page (`/`) with a new design that wins "best looking" at DivHacks judging:
an editorial, New York magazine look whose centrepiece is Google's photorealistic 3D
Manhattan. The previous design (neumorphic glass, verdigris, Playfair) is not carried over.

Success criteria:
- The intro (letters → dive → orbiting 3D city) plays smoothly: no dropped frames during the
  dive on a 2020+ laptop, and no blank or black letters at any point.
- Lighthouse (desktop) Performance ≥ 90 for `/`; LCP element is server-rendered text.
- A visit that never scrolls past the hero costs exactly one Google 3D map load.
- The page still works (with the MapLibre satellite fallback) when Google fails, the key is
  missing, or WebGL is unavailable.
- The prompt still submits to `/plan?q=…`, unchanged.

Out of scope (later sub-projects): the planner (`/plan`), Aceternity / Magic UI components,
photography, copy changes beyond what is listed here.

## Visual system

Scoped to the home page: all tokens live under a `.ed` root class on `<main>`, so the
planner's shared shadcn tokens in `globals.css` are untouched until the planner is redesigned.

| Token | Light ("Morning edition") | Dark ("Evening edition") |
|---|---|---|
| `--paper` | `#f3ede1` | `#1a1815` |
| `--ink` | `#15120e` | `#efe8da` |
| `--muted` | `#6d6457` | `#a39a8b` |
| `--rule` | `var(--ink)` | `rgba(239,232,218,.35)` |
| `--red` (the one accent) | `#c8321f` | `#e0543f` |

Type (via `next/font/google`, `display: swap`, only the weights listed):
- Display: **Instrument Serif** 400, roman + italic. Headlines, "New York", the wordmark.
- Text: **Newsreader** 400/600 + italic 400. Body, prompt input, itinerary rows.
- Labels: **IBM Plex Mono** 400/500. Uppercase, `letter-spacing: .14em`, 11px. Kickers,
  datelines, captions, buttons.

Motifs: 1px ink rules and 3px double rules between sections; hard offset shadow
(`6px 6px 0 var(--ink)`) on the prompt and callout cards; numbered red route bullets
(①②③) for stops; figure-style mono captions ("Plate I · Midtown Manhattan, live").
Paper grain is a static background image on paper sections only (never a fixed, blended
full-page overlay, which forces blending over the WebGL canvases every frame).

The existing `ThemeToggle` and `roam_theme` localStorage key are kept; `.dark` swaps the
`.ed` tokens. Over the map, the hero chrome is always light-on-dark regardless of theme.

## Page structure

1. **Hero** (`100dvh`): full-bleed 3D map; header (wordmark, section links, theme toggle,
   "Open planner"); kicker + dateline; vertical coordinates ticker; the intro; then the
   deck: "New York" (display, paper colour), "See it all. *Skip the crowds.*", the prompt
   and three journey links.
2. **Watch it plan**: left, "One sentence in. *A whole day out.*", a self-typing prompt, and
   an itinerary that builds row by row (bullet, time, name, reason, crowd bars). Right, a
   3D map where the route draws and numbered 3D pins drop, ending on a
   "44 min less travel" callout. Replay button. Demo data is static (no API calls).
3. **Neighborhoods** (scrollytelling): chapters on the left (Greenwich Village, Upper West
   Side, DUMBO, Midtown); a sticky 3D map on the right flies to each one and orbits slowly.
   Each chapter ends with a "Plan a day here →" link to `/plan?q=…` (reusing the current
   `NEIGHBORHOODS` queries).
4. **Colophon** (footer): wordmark, one-line pitch, data sources (Google Maps, OSM, MTA,
   Open-Meteo), links.

The old "Engineered for the real NYC" features block is removed; section 2 shows it instead.

## The intro, precisely

1. The hero map mounts at `{ center: 40.738,-73.990, range: 9000, tilt: 0, heading: -30 }`.
2. Until the city has painted (first `gmp-steadychange` with `isSteady`, or 8s of *visible*
   time), the hero is blank paper: the letters are hidden. This matches the approved
   prototype (`reel-3d.html`) and trades a later LCP for the effect.
3. The letters of "New York" rise (stagger 60ms from 0.1s, 1.1s each) with the city already
   inside them. The map orbits the high view (`flyCameraAround`, 240s per turn).
4. 2.3s after the letters start rising, the dive:
   - Find the zoom origin: rasterise the word at 25% scale on a canvas, run a two-pass
     chamfer distance transform, pick the deepest stroke pixel (weighted towards the
     horizontal centre). Precomputed while the letters rise; recomputed only on resize.
   - `cover = viewportDiagonal / strokeRadius`, `sEnd = cover × 2.2`.
   - 280ms anticipation (scale 1 → 0.965), then 1700ms exponential zoom
     `s = 0.965 · (sEnd/0.965)^ease(u)` (cubic in-out). Opacity stays 1 until `s ≥ cover`,
     then falls with `log(s/cover)`. Only `transform` and `opacity` change, written from a
     single `requestAnimationFrame` loop; `will-change: transform` is set only for the dive.
   - At the same moment, `flyCameraTo` the landed camera
     `{ center: ESB 40.7484,-73.9857 alt 180, range: 1500, tilt: 64, heading: 30 }` over 3.6s,
     then `flyCameraAround` at 200s per turn.
5. At 70% of the dive: scrims fade in and the chrome turns light. At the end: the knockout
   layer is removed from the DOM, and "New York" re-sets letter by letter as the headline.
   +750ms later: the tagline, prompt and links rise in.

Once per browser session (`sessionStorage["roam_intro"]`); later loads and
`prefers-reduced-motion: reduce` start in the landed state. Reduced motion also disables all
orbits and the demo animation (the demo shows its final state).

## Performance

- **Server first.** `page.tsx` stays a server component: all copy, the header, the deck and
  the knockout word are server-rendered HTML (the knockout text is the LCP element). Maps
  and animation are small client islands.
- **One loader.** Load the Maps JS API once via `@googlemaps/js-api-loader`
  (`setOptions({ key, v: "beta" })` + `importLibrary("maps3d")`), started from the hero island
  after hydration. `beta`, not `alpha`: in alpha every overlay constructor throws (checked
  2026-09-26). Add `preconnect` to `maps.googleapis.com` and `maps.gstatic.com`.
- **Lazy maps.** The demo map is created once its section is 15% into view (it starts at the
  fold, so any look-ahead margin would load it on page load); the neighborhood map half a
  viewport ahead. Never on the server.
- **Engine switch.** `NEXT_PUBLIC_MAP_ENGINE=maplibre` (in `.env.local`) forces the free
  MapLibre map everywhere for local development; unset for demos and hosting. A visitor who stays in the hero pays for one map load.
- **Offscreen = idle.** A map whose section leaves the viewport stops its camera animation
  (`stopCameraAnimation`); the orbit resumes on re-entry. All orbits stop on
  `document.visibilitychange` → hidden. Maps are not destroyed on scroll-out (re-creating
  one is another billed load).
- **Cheap per-frame work.** The coordinates ticker updates at most every 250ms. The demo's
  route grows in 24 steps per leg (not per frame). Scroll work is done only through
  `IntersectionObserver`: no scroll listeners.
- **Fonts.** `next/font` self-hosts and preloads the three families; the intro waits on
  `document.fonts.ready`, so measurement uses the real glyphs.
- **Lite devices.** If `navigator.connection.saveData` is set or `navigator.deviceMemory ≤ 2`,
  the demo and neighborhood maps use the MapLibre fallback, and the hero skips the intro.
- **Fallback.** If the key is missing, the loader rejects, `gmp-error` fires,
  `gm_authFailure` is called, or WebGL is unavailable, the island renders the existing
  MapLibre satellite map (`SATELLITE_3D_STYLE`), imported dynamically only in that case.
  The intro then runs the same dive over MapLibre.
- **Attribution.** Google's logo and attribution stay visible (ToS); layout keeps the
  bottom-left 120×30px clear of the deck.

## Components

```
src/app/page.tsx                    server: sections + data, `.ed` root
src/components/home/
  camera.ts                         Camera/LatLng types, rangeToZoom, ticker text, route interpolation (pure, tested)
  data.ts                           all home copy + cameras (journeys, neighborhoods, demo, hero)
  fonts.ts                          next/font families for the home page
  cityMap.ts                        CityMap interface, engine choice (pure, tested), createCityMap
  cityMapGoogle.ts                  Google 3D implementation (loader, beta channel, failure detection)
  cityMapLibre.ts                   MapLibre satellite fallback implementation (dynamic import only)
  useCityMap.ts                     React hook: create on demand, destroy on unmount
  visibility.ts                     useInView, usePageVisible, usePrefersReducedMotion
  diveOrigin.ts                     thickest-stroke finder (pure core tested) + DOM measurement
  HeroStage.tsx          client     hero markup, map, intro choreography, ticker
  HomePrompt.tsx         client     editorial prompt → router.push(/plan?q=…)
  PlanDemo.tsx           client     typing prompt, itinerary rows, route + pins
  NeighborhoodStory.tsx  client     sticky map + chapter observer
  Colophon.tsx                      server section
src/app/home.css                    `.ed` tokens + section styles (imported by page)
```

`HomePrompt` replaces `LandingPrompt` on the home page (same submit behaviour: trimmed text,
1500 char limit, `/plan?q=`). `LandingPrompt`, `AmbientMap` and `LazyMaps` are deleted if
nothing else imports them after the change. The `.neo-*` styles in `globals.css` that only
the home page used are deleted.

Docs: update `AGENTS.md` (home is now Google photorealistic 3D with a MapLibre fallback,
not the locked MapLibre satellite view) and the Landing Page section of `docs/UI-UX.md`.

## Testing

- Unit (vitest): `diveOrigin` (returns a point inside a stroke with radius > 0 for a known
  glyph box; handles a zero-size box); `cityMap.chooseEngine` (no key or no WebGL → fallback;
  saveData / low memory → fallback for secondary maps only); `camera` helpers.
- Manual, in the browser: intro once per session; replay; reduced motion; dark mode; the
  fallback forced by an invalid key; 375px and 1440px widths; prompt submit lands on
  `/plan?q=`.
- Performance: Lighthouse desktop on `next build && next start`; Chrome Performance
  recording of the dive (no long tasks > 50ms during the dive).
- `npm run lint`, `npm test`, `npm run build` pass.

## Risks

- `beta` channel changes under us: pin the loader call in one place (`cityMapGoogle.ts`) so the
  channel is one edit; the MapLibre fallback covers a hard break.
- Billing: 3D maps are a Pro SKU, 10,000 free loads a month. Worst case 3 loads per full
  visit. The owner sets a daily quota (~300 loads/day) in Google Cloud as the backstop.
