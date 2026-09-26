# Roam Hybrid Glass-Neumorphic Design System (NYC & Sitcom Edition)

Roam features a signature **Hybrid of Glassmorphism and Neumorphism** ("Neo-Glass") infused with an iconic **New York City & NYC Sitcom color palette** (*Friends*, *Seinfeld*, *How I Met Your Mother*, NYC Yellow Cab, MTA subway lines).

---

## 1. Design Philosophy & Aesthetic Principles

- **Neo-Glass Materiality (Glassmorphism + Neumorphism)**:
  - **Frosted Translucency**: Surfaces utilize high-performance backdrop blurs (`backdrop-filter: blur(18px-24px) saturate(170%-190%)`) with semi-transparent tinted glass backgrounds, allowing ambient NYC city lighting and map geometry to illuminate through.
  - **Soft Tactile Elevation**: Elevated elements (`.neo-raised`, `.neo-card`, `.neo-control`) push outward with paired directional drop shadows (specular light top-left, soft ambient shadow bottom-right).
  - **Specular Glass Rims**: Polished inset highlights (`inset 0 1px 1px 0 var(--neo-glass-rim)`) simulate physical beveled glass borders.
  - **Clean Inset Debossing**: Recessed elements (`.neo-inset`, text inputs, textareas) are debossed cleanly into the frosted plane without jarring selection rings or double-borders when focused.
- **NYC Sitcom & City Color Identity**:
  - **NYC Taxi Amber & HIMYM Yellow Umbrella** (`--nyc-taxi`): Glowing golden hour taxi yellow.
  - **Friends (Greenwich Village & Central Perk)**:
    - Central Perk Velvet Couch Orange (`--friends-orange`): Warm terracotta amber.
    - Monica's Apartment Purple Door (`--friends-purple`): Classic village bohemian purple.
    - Central Perk Sign Green (`--friends-green`): Rich chalkboard coffeehouse green.
  - **Seinfeld (Monk's Diner & Upper West Side)**:
    - Monk's Diner Neon Blue (`--seinfeld-blue`): Electric diner sign blue.
    - Diner Neon Sign Crimson (`--seinfeld-red`): Radiant neon red.
  - **How I Met Your Mother (MacLaren's Pub)**:
    - MacLaren's Irish Pub Warm Ale & Wood (`--himym-amber`): Rich roasted tavern amber.
- **Dual Mode Palette Refinements (Light & Dark)**:
  - **Light Mode ("Manhattan Linen & Limestone")**:
    - Warm architectural limestone ivory canvas (`oklch(0.978 0.008 85)`), frosted alabaster glass cards (`oklch(0.995 0.003 85)`), and warm architectural taupe drop shadows (`rgba(160, 148, 132, 0.32)`).
    - Evokes daytime Manhattan sunshine, Central Perk warmth, and yellow cabs on the avenues.
  - **Dark Mode ("Gotham Midnight Slate")**:
    - Replaces pitch-black void with deep NYC twilight midnight slate (`oklch(0.215 0.032 258)` / `#131a2b`), rich midnight glass cards (`oklch(0.265 0.038 256)` / `#1a2339`), and navy-tinted shadow troughs (`rgba(8, 12, 24, 0.70)`).
    - Evokes NYC neon nightlights, Monk's diner glows, and late-night tavern warmth without harsh eye strain.
  - **Silky Smooth Theme Cross-Fade**:
    - Smooth 340ms transitions (`cubic-bezier(0.4, 0, 0.2, 1)`) for background color, border color, and box shadow prevent jarring flashes when toggling between themes.
  - **Vibrant Google Maps-Style Multi-View Maps**:
    - **Day**: Google Maps-style vibrant daytime vector streets, green parks, blue rivers, and colored subway transit lines.
    - **Night**: Gotham nighttime dark map with illuminated avenue corridors and neon bridges.
    - **Satellite**: Photorealistic high-resolution orbital imagery via ESRI / NASA World Imagery tiles.
    - **Transit**: Dedicated MTA subway & rail transport layer with highlighted lines, stations, and ferry crossings.
    - Switched seamlessly via `<MapThemeSwitcher />` with both direct tactile pills and an expandable **Map Layers** preview drawer.
  - **Full Viewport Canvas Designing (Viewport Height & Width Always)**:
    - Design and style using full viewport height and width (`100dvh`, `100vw`, `w-full`, uniform edge padding `px-6 sm:px-10 lg:px-14 xl:px-16 2xl:px-20`).
    - Equal left and right margins across the entire layout; no narrow `max-w` containers trapping content.
    - Never confine the hero or primary views into small centered boxes that waste screen real estate. Use generous 2-column and multi-card canvas proportions across all screens.
    - **Home Page Ambient Map**: Permanently locked to the slow-rotating 3D Satellite view with terrain DEM (unobstructed high-resolution satellite imagery free of artificial grey vector polygon blocks). No map switcher on the home page.
    - **Planner Map**: Supports full Google Maps-style layers (Day, Night, Satellite, Transit) and real-time user geolocation ("Locate Me").

---

## 2. Core Tokens & Utility Classes

The system is defined globally in [`src/app/globals.css`](file:///Users/rishi/Desktop/CLG/divhacks-2026/src/app/globals.css):

### Typography
- Primary Sans: `Plus_Jakarta_Sans` (crisp, modern geometric grotesque).
- Display Heading: `Outfit` (punchy, high-energy editorial face).
- Monospace: `Geist_Mono` (tabular timestamps and coordinates).

### CSS Variables
- `--brand`: Primary NYC Taxi & Central Perk amber core (`oklch(0.68 0.19 55)` light, `oklch(0.80 0.18 75)` dark).
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
