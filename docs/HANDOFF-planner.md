# Handoff: redesign the planner (`/plan`) in the home page's design system

**For:** the agent picking this up (Codex). **From:** the home page redesign (branch `feat-ui`).
**Read first, in order:** `AGENTS.md` → `docs/DESIGN.md` (the design system) → this file →
`docs/UI-UX.md` §"Planner Page" (what the planner does today) → the home page code in
`src/app/home.css` and `src/components/home/` (the reference implementation).

## 1. Goal

Make `/plan` look and feel like the next page of the same magazine as the home page: paper and
ink, Instrument Serif / Newsreader / IBM Plex Mono, one red accent, rules instead of cards, the
map as the photograph. **Change the presentation only.** Every planner feature keeps working
exactly as it does now.

The home page is final and approved: don't change it, except to extract shared styles (§4 step 1).

## 2. Hard constraints

- **Behaviour is frozen.** Keep every feature listed in `docs/UI-UX.md` §"Planner Page": the
  prompt and `/plan?q=…` auto-planning, trip details, browse places (StopPicker), Discover search,
  itinerary with stop cards and leg links, day playback, insights, ChoicePanel options, DayPicker,
  TripChat, save/share (`/plan?plan=<code>` links must still rebuild the same day), re-plan
  (NextUp / ReplanDialog), PlaceSheet, the desktop resizable split pane (360–720px, keyboard
  accessible) and the mobile bottom sheet (peek / half / full snaps).
- **No API or data changes.** Don't touch `src/app/api/**` or `src/lib/**` except to add purely
  presentational helpers. All existing tests must still pass (`npm test`).
- **Planner map stays MapLibre** (`PlanMap.tsx`): keep Day / Night / Satellite / Transit layers and
  Locate Me (see `AGENTS.md`). Restyle it; don't swap the engine.
- **Next.js 16:** read the relevant guide in `node_modules/next/dist/docs/` before writing code.
- **Fluid sizing only:** type and spacing from the `clamp()` tokens, `em` or `min()`; no fixed-px
  type or spacing. Full viewport width, equal gutters.
- **Both themes are first-class** (light "Morning edition", dark "Evening edition").
- **Accessibility stays at least as good:** keyboard access, `aria-*` labels, live regions and
  focus rings (use the red focus outline from `.ed-btn:focus-visible`).

## 3. Design translation

| Planner today | Editorial version |
|---|---|
| Glass / neumorphic panels (`.neo-raised`, `.neo-card`, `.neo-panel`) | Paper (`.ed-paper`) with 1px `--rule` borders; sections separated by 3px double rules |
| Rounded pill buttons, `.neo-primary` | `.ed-btn` (ink fill) and `.ed-btn--ghost` (outline): square, mono, uppercase |
| Inset inputs (`.neo-inset`), the prompt textarea | `.ed-prompt`: field colour, ink border, hard offset shadow, red shadow on focus |
| Category chips | Mono uppercase labels; the active one gets a red underline (like the old story index) or ink fill |
| Numbered stop badges | `.ed-bullet` (red circle, mono numeral) |
| Stop cards | `.ed-row` pattern: bullet, time (mono), name (serif) + reason (italic, muted), crowd bars |
| CrowdStrip | `.ed-crowd` bars with the chosen hour in `--red` |
| Leg rows ("12 min walk", directions link) | A thin ruled line between rows with a mono caption; the link as an italic underlined text link |
| Section titles in the panel | `.ed-kicker` (red mono) + serif heading (`.ed-h2` or a smaller clamp) |
| Callouts ("44 min saved", insights) | `.ed-callout`: paper card with the offset shadow |
| Brand / verdigris accent colours | `--red` for accents only; everything else ink and paper |
| Map controls | Square `.ed-btn--ghost` buttons with the map's `--on-map` treatment when over imagery |
| Map caption | Like the home plates: `Plate · Your day, live` in mono at a corner |
| Theme toggle | The shared `ThemeToggle` with `className="ed-theme"` |

**Layout.**
- Desktop: the side panel is the paper column; the map is the plate.
- Header: the same editorial header as home (wordmark "Roam", mono links, toggle,
  one ink button), compact.
- Mobile: keep the bottom sheet as a paper sheet with a top rule and a mono handle label.

**Map style (`PlanMap.tsx`).**
- Make an editorial vector style for Day: paper land, ink roads (weights by class), muted water,
  mono labels.
- Night uses the dark tokens.
- Keep Satellite and Transit, but give their chrome the editorial treatment.
- Route markers become red numbered bullets.
- Leg lines by mode use ink/red: walk as ink dashes, subway as solid red, bike as ink dots,
  car as solid ink.
- Keep the credits visible (collapsed ⓘ is fine; see `cityMapLibre.ts`).

**Motion.** One moment per interaction, only `transform`/`opacity`, respect reduced motion. For
example: itinerary rows rise in like the home demo (`.ed-row` → `.on`) when a plan arrives; legs draw
in. No perpetual motion off screen.

## 4. Suggested order of work (commit after each)

1. **Extract shared styles.** Split `src/app/home.css` into `src/app/editorial.css` (the `.ed`
   tokens, paper grain, type roles, `.ed-btn`, `.ed-prompt`, `.ed-chips`, `.ed-bullet`, `.ed-row`,
   `.ed-crowd`, `.ed-callout`, rules) and `home.css` (hero, demo, story, colophon). Load
   `editorial.css` for both pages; move `edFonts` (`src/components/home/fonts.ts`) somewhere both
   can import. **Check the home page is pixel-identical afterwards.**
2. **Planner shell:** wrap `/plan` in `<main className={\`ed ${edFonts}\`}>`, restyle `PlannerView.tsx`
   (header, split pane, resize handle, bottom sheet).
3. **Components, one per commit:** `Itinerary`, `CrowdStrip`, `ChoicePanel`, `DayPicker`, `Discover`,
   `StopPicker`, `TripChat`, `NextUp`, `ReplanDialog`, `PlaceSheet`, `ProfileCard`.
4. **Map style** in `PlanMap.tsx` / `src/components/map/mapStyle.ts`.
5. **Remove `.neo-*`** from `src/app/globals.css` once `grep -rn "neo-" src` finds nothing, and
   drop the old planner-only tokens that nothing uses.
6. **Docs:** update `docs/DESIGN.md` (status line, §8), `docs/UI-UX.md` §"Planner Page" and the
   Color System / Typography sections.

## 5. Verification (every step)

- `npm test`, `npm run lint`, `npx tsc --noEmit -p .`, `npm run build`: all green.
- Widths 375, 768, 1024, 1440, 1920, 2560: no horizontal overflow; the split pane at ≥1024, the
  sheet below.
- Light and dark; reduced motion; keyboard only.
- Flows, end to end:
  - type on the home prompt → lands on `/plan?q=…` → plans automatically;
  - pick places by hand → plan;
  - open a stop's PlaceSheet;
  - choose an option in ChoicePanel;
  - change the day;
  - ask TripChat something;
  - save a plan, then copy the share link and open it in a new tab (same day rebuilds);
  - re-plan from "now";
  - mobile sheet peek / half / full.

## 6. Gotchas learned on the home page

- **Link colour specificity:** a rule like `.ed a { color: inherit }` beats `.ed-btn`'s colour on
  `<a class="ed-btn">` and turns button text invisible. Use `:where(.ed) a` (already in
  `home.css`).
- **Shared `ThemeToggle`:** it ships planner colours (slate moon / amber sun); on editorial
  pages pass `className="ed-theme"` so the icon follows the text colour.
- **Theme switching:** it uses View Transitions (circle reveal from the toggle). The
  `.theme-switching` class pauses CSS transitions during the snapshot; don't remove it from
  `globals.css`.
- **Env values are baked in:** `NEXT_PUBLIC_*` is fixed at build time. The home map engine is
  `NEXT_PUBLIC_MAP_ENGINE` (`maplibre` in `.env.local` for development, `google` for demos).
- **Credits:** never hide map credits entirely (Esri, Google, OpenStreetMap / OpenFreeMap).
  Collapsing to ⓘ is fine.
- **Dark mode over imagery:** text over a map is always `--on-map` (light) with a scrim, in
  both themes.
- **Dev server:** if the page looks stale, check nothing else is on port 3000 (`next start` shows
  up as `next-server`).

## 7. Out of scope

- The home page (beyond the style extraction).
- New features.
- Aceternity / Magic UI components (planned for later; the system should leave room for them:
  they must use the tokens, not their default palettes).
- Swapping the planner's map engine.
