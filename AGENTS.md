<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Roam Canvas & Layout Guidelines

- **Viewport Height & Width Always**: Design and style using full viewport height and width (`100dvh`, `100vw`, `w-full`, uniform edge padding `px-6 sm:px-10 lg:px-14 xl:px-16 2xl:px-20`).
- **No Constrained Narrow Boxes**: Never confine the hero or primary views into small centered boxes that waste screen real estate. Use generous 2-column and multi-card canvas proportions across all screens, with equal left and right margins.
- **Home Page Ambient Map**: Always locked to the slow-rotating 3D Satellite view with terrain DEM (unobstructed high-resolution satellite imagery free of artificial grey vector polygon blocks). No map switcher on the home page.
- **Planner Map**: Supports full Google Maps-style layers (Day, Night, Satellite, Transit) and real-time user geolocation ("Locate Me").
