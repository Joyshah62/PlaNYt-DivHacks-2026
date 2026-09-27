<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PlaNYt Canvas & Layout Guidelines

- **Design system**: Read `docs/DESIGN.md` before building or restyling any page. The home page (`src/app/home.css`, `src/components/home/`) is the reference: editorial paper-and-ink, Instrument Serif / Newsreader / IBM Plex Mono, one red accent, the 3D city as photography. New pages use the same tokens and components; the planner redesign brief is `docs/HANDOFF-planner.md`.
- **Viewport Height & Width Always**: Design and style using full viewport height and width (`100dvh`, `100vw`), with equal left and right gutters (`--gut` / `.ed-gut`). Type and spacing are fluid (`clamp()` tokens, `em`), never fixed pixels; check 375 → 2560px wide with no horizontal overflow.
- **No Constrained Narrow Boxes**: Never confine the hero or primary views into small centered boxes that waste screen real estate. Use generous 2-column and multi-card canvas proportions across all screens, with equal left and right margins.
- **Home Page Map**: The home page uses Google's photorealistic 3D Maps (`src/components/home/cityMapGoogle.ts`, Maps JS channel `beta`) behind an editorial layout, with the MapLibre satellite view as the automatic fallback (`cityMapLibre.ts`). The intro (letters rise with the city inside → dive → orbit) plays on every page load (reduced motion and lite devices start landed). Choose the engine with `NEXT_PUBLIC_MAP_ENGINE` (`maplibre` for development, `google` for demos and hosting). No map switcher on the home page.
- **Planner Map**: Supports full Google Maps-style layers (Day, Night, Satellite, Transit) and real-time user geolocation ("Locate Me").
