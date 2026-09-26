# Roam Hybrid Glass-Neumorphic Design System (NYC & Sitcom Edition)

Roam features a signature **Hybrid of Glassmorphism and Neumorphism** ("Neo-Glass") infused with an iconic **New York City & NYC Sitcom color palette** (*Friends*, *Seinfeld*, *How I Met Your Mother*, NYC Yellow Cab, MTA subway lines).

---

## 1. Design Philosophy & Aesthetic Principles

- **Neo-Glass Materiality (Glassmorphism + Neumorphism)**:
  - **Frosted Translucency**: Surfaces utilize high-performance backdrop blurs (`backdrop-filter: blur(18px-24px) saturate(170%-190%)`) with semi-transparent tinted glass backgrounds, allowing ambient NYC city lighting and map geometry to illuminate through.
  - **Soft Tactile Elevation**: Elevated elements (`.neo-raised`, `.neo-card`, `.neo-control`) push outward with paired directional drop shadows (specular light top-left, soft ambient shadow bottom-right).
  - **Specular Glass Rims**: Polished inset highlights (`inset 0 1px 1px 0 var(--neo-glass-rim)`) simulate physical beveled glass borders.
  - **Clean Inset Debossing**: Recessed elements (`.neo-inset`, text inputs, textareas) are debossed cleanly into the frosted plane without jarring selection rings or double-borders when focused.
- **NYC & Sitcom Color Identity**:
  - **Statue of Liberty Verdigris & Mint Copper Patina** (`--brand`): Rich oxidized copper teal-mint patina (`oklch(0.64 0.15 178)` light, `oklch(0.79 0.16 176)` dark). Inspired by Lady Liberty standing in New York Harbor, Tiffany & Co. heritage, and Central Park copper roofs.
  - **NYC Taxi Amber & HIMYM Yellow Umbrella** (`--nyc-taxi`): Golden hour taxi yellow accent.
  - **Friends (Greenwich Village & Central Perk)**:
    - Central Perk Velvet Couch Orange (`--friends-orange`): Warm terracotta amber.
    - Monica's Apartment Purple Door (`--friends-purple`): Classic village bohemian purple.
    - Central Perk Sign Green (`--friends-green`): Rich chalkboard coffeehouse green.
  - **Seinfeld (Monk's Diner & Upper West Side)**:
    - Monk's Diner Neon Blue (`--seinfeld-blue`): Electric diner sign blue.
    - Diner Neon Sign Crimson (`--seinfeld-red`): Radiant neon red.
  - **How I Met Your Mother (MacLaren's Pub)**:
    - MacLaren's Irish Pub Warm Ale & Wood (`--himym-amber`): Rich roasted tavern amber.
- **Translucent Neo-Glass System (Glassmorphism + Neumorphism)**:
  - **Deep Frosted Translucency**: Surfaces utilize high-performance backdrop blurs (`backdrop-filter: blur(28px-32px) saturate(190%-200%)`) with tuned opacity (~70% in dark mode, ~78% in light mode). This lets the rotating 3D satellite view and Manhattan skyline drift subtly behind cards without compromising WCAG AAA text contrast or readability.
  - **Soft Tactile Elevation**: Elevated elements (`.neo-raised`, `.neo-card`, `.neo-control`) push outward with paired directional drop shadows (specular light top-left, soft ambient shadow bottom-right).
  - **Specular Glass Rims**: Polished inset highlights (`inset 0 1px 1px 0 var(--neo-glass-rim)`) simulate physical beveled glass borders.
  - **Clean Inset Debossing**: Recessed elements (`.neo-inset`, text inputs, textareas) are debossed cleanly into the frosted plane without jarring selection rings or double-borders when focused.
- **Phosphor Duotone Iconography (`@phosphor-icons/react`)**:
  - Selected for its dual-tone rendering (`weight="duotone"`), providing a subtle 20% opacity primary fill behind crisp perimeter strokes. This layered depth mirrors the glassmorphism of the UI surfaces.
- **Editorial Typography System**:
  - **Display Serif**: `Playfair_Display` (`--font-display`), creating the high-end editorial feel of a luxury Manhattan publication.
  - **Primary Sans**: `Plus_Jakarta_Sans` (`--font-sans`), crisp, modern geometric grotesque for readability.
  - **Accent**: `Outfit` (`--font-accent`) for punchy badges and statistics.
  - **Monospace**: `Geist_Mono` for tabular timestamps and coordinates.
- `--nyc-taxi`: Iconic NYC Cab Yellow / HIMYM Yellow Umbrella.
- `--friends-orange`: Central Perk velvet couch orange.
- `--friends-purple`: Monica's apartment door purple.
- `--friends-green`: Central Perk chalkboard green.
- `--seinfeld-blue`: Monk's Diner neon blue.
- `--seinfeld-red`: Neon sign crimson.
- `--himym-amber`: MacLaren's pub mahogany & warm amber ale.
- `--neo-glass-bg`, `--neo-glass-card`, `--neo-glass-inset`: Translucent frosted bases.
- `--neo-light` / `--neo-dark`: Bi-directional drop shadow tokens.
- `--neo-glass-rim`: Beveled glass rim specular highlight.

### Core Utility Classes
- `.neo-raised`: Standard glass-neumorphic elevation for cards and dialogs with specular rim and ambient blur.
- `.neo-raised-sm`: Compact glass-neumorphic elevation for badges and chips.
- `.neo-raised-lg`: High elevation for bottom sheets and modals.
- `.neo-inset`: Frosted debossed cavity with zero focus selection border for inputs, textareas, and active track wells.
- `.neo-control`: Interactive tactile glass button with resting elevation and physical `:active` depression.
- `.neo-primary`: NYC amber brand action button with luminous sheen and tactile feedback.
- `.neo-panel`: Sticky sidebar or bottom sheet container with deep backdrop blurring.
- `.neo-card`: Uniform card wrapper combining frosted surface, glass specular edge, and tactile elevation.
- `.neo-map-wash`: Architectural gradient vignette that cleanly showcases the map geometry behind UI layers.

---

## 3. Component Architecture & Implementation

### A. Theme & Map Style Management
- [`src/components/theme/ThemeToggle.tsx`](file:///Users/rishi/Desktop/CLG/divhacks-2026/src/components/theme/ThemeToggle.tsx): Tactile raised button toggling between light and dark themes with smooth icon rotation and dual `.dark`/`.light` class synchronization.
- [`src/components/map/MapThemeSwitcher.tsx`](file:///Users/rishi/Desktop/CLG/divhacks-2026/src/components/map/MapThemeSwitcher.tsx): Tactile glass-neumorphic segmented control and expandable Map Layers drawer toggling between Day, Night, Satellite, and Transit map backdrops.
- [`src/components/map/mapStyle.ts`](file:///Users/rishi/Desktop/CLG/divhacks-2026/src/components/map/mapStyle.ts): Multi-style map engine with raster satellite & transit providers and vector OpenFreeMap styles.

### B. Landing Page 2-Column Canvas & Explorations
- [`src/app/page.tsx`](file:///Users/rishi/Desktop/CLG/divhacks-2026/src/app/page.tsx):
  - **2-Column Hero**: Left column features branding, value proposition, live subway & crowd metrics, and map style switcher; right column houses the interactive `<LandingPrompt />`.
  - **Proper Preset Buttons**: 6 tactile presets for Friends, Seinfeld, HIMYM, Skyline, Brooklyn, and Broadway nightlife.
  - 4-card multi-column **Featured Journeys** (Friends Village Walk, Seinfeld UWS Tour, HIMYM Midtown Trail, Gotham Skyline & High Line).
  - 6-card **Neighborhood Explorer** (Greenwich Village, SoHo, DUMBO, Upper West Side, Chelsea, Midtown).
  - **NYC Urban Intelligence** cards (Live MTA routing, Crowd flow rhythm, Adaptive live schedule).

### C. Planner & Itinerary (`/plan`)
- [`src/components/plan/PlannerView.tsx`](file:///Users/rishi/Desktop/CLG/divhacks-2026/src/components/plan/PlannerView.tsx):
  - Neumorphic nav header with ThemeToggle, MapThemeSwitcher, and raised compass icon.
  - Sidebar with tactile `.neo-panel` styling.
  - Build view form: `.neo-raised` prompt card, `.neo-inset` textarea, `.neo-primary` submit button, `.neo-control` starter pills, and `.neo-inset` time/date inputs.
- [`src/components/plan/Itinerary.tsx`](file:///Users/rishi/Desktop/CLG/divhacks-2026/src/components/plan/Itinerary.tsx):
  - Quick action pills (Save, Calendar, Share, Open in Google Maps) styled as `.neo-control`.
  - Metrics cards (Travel time, Saved, Crowds) styled as `.neo-raised`.
  - Stop cards with `.neo-raised` elevation and `.neo-inset` / `.neo-primary` numbered pin badges.
  - Meal break cards with tactile debossed cavity.
- [`src/components/plan/PlanMap.tsx`](file:///Users/rishi/Desktop/CLG/divhacks-2026/src/components/plan/PlanMap.tsx):
  - Inset category filter bar with `.neo-control` pills.
  - Floating 2D/3D map toggle and `<MapThemeSwitcher showLayersDialog={true} />`.
  - Floating "Locate Me" GPS crosshair button with real-time location puck and fly-to animation.
  - Floating timeline playback bar with tactile play button and crowd density toggles.
- [`src/components/plan/Itinerary.tsx`](file:///Users/rishi/Desktop/CLG/divhacks-2026/src/components/plan/Itinerary.tsx):
  - Quick action pills (Save, Calendar, Share, Open in Google Maps) styled as `.neo-control`.
  - Metrics cards (Travel time, Saved, Crowds) styled as `.neo-raised`.
  - Stop cards with `.neo-raised` elevation and `.neo-inset` / `.neo-primary` numbered pin badges.
  - Meal break cards with tactile debossed cavity.
- [`src/components/plan/PlanMap.tsx`](file:///Users/rishi/Desktop/CLG/divhacks-2026/src/components/plan/PlanMap.tsx):
  - Inset category filter bar with `.neo-control` pills.
  - Floating 2D/3D map toggle and `<MapThemeSwitcher />`.
  - Floating timeline playback bar with tactile play button and crowd density toggles.
- [`src/components/plan/TripChat.tsx`](file:///Users/rishi/Desktop/CLG/divhacks-2026/src/components/plan/TripChat.tsx):
  - Chat card with `.neo-inset` composer, `.neo-primary` send button, and tactile suggestion chips.

---

## 4. Accessibility & Semantic Preservation

- **Contrast & Legibility**: Never rely solely on soft shadows for visual boundaries. All inputs and cards retain distinct foreground-to-background contrast meeting WCAG AA guidelines.
- **Focus Rings**: Standard outline and ring rings (`ring-2 ring-brand ring-offset-2`) remain active on keyboard `:focus-visible`.
- **Reduced Motion**: Respects `@media (prefers-reduced-motion: reduce)` by suppressing physical button translateY scaling, while preserving visual elevation.
