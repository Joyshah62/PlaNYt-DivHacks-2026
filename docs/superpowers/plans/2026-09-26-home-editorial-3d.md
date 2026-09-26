# Home Page "Editorial × 3D Manhattan" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/` with the editorial, Google-photorealistic-3D home page (ink letters → city inside the letters → dive → orbiting Empire State), built for performance, with a MapLibre fallback.

**Architecture:** `page.tsx` stays a server component that renders all copy. Three small client islands (`HeroStage`, `PlanDemo`, `NeighborhoodStory`) each own one map through a single `CityMap` interface. Google 3D (`cityMapGoogle.ts`) is the default engine and MapLibre (`cityMapLibre.ts`) is the fallback, and both are dynamically imported, so neither is in the initial bundle. Animation writes to the DOM through refs (no React re-render per frame). Maps are created only near the viewport and go idle off screen.

**Tech Stack:** Next.js 16.3 (App Router, `next/font`), React 19.2, TypeScript, plain CSS (`src/app/home.css`), `@googlemaps/js-api-loader` 2.x (Maps JS `maps3d`, channel `beta`), `maplibre-gl` 6 (existing), vitest 5 (node environment).

**Spec:** `docs/superpowers/specs/2026-09-26-home-editorial-3d-design.md`

## Global Constraints

- Scope: home page only. Every new style is under `.ed` / `ed-*` class names; don't change `:root`/`.dark` tokens in `globals.css`. The planner (`/plan`) must look and work exactly as before.
- Tokens (light / dark): `--paper #f3ede1 / #1a1815`, `--ink #15120e / #efe8da`, `--muted #6d6457 / #a39a8b`, `--rule var(--ink) / rgba(239,232,218,.35)`, `--red #c8321f / #e0543f`.
- Fonts: Instrument Serif 400 (normal+italic), Newsreader 400/600 (+italic), IBM Plex Mono 400/500, via `next/font/google`, `display: "swap"`.
- Maps JS: channel `v: "beta"` (alpha breaks overlay constructors), key `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, library `maps3d`, `mode: SATELLITE`, `defaultUIHidden: true`. Google's logo/attribution must stay visible.
- Cameras: hero high `{lat 40.738, lng -73.990, alt 0, range 9000, tilt 0, heading -30}`, hero landed `{lat 40.7484, lng -73.9857, alt 180, range 1500, tilt 64, heading 30}`. Orbit periods: high 240s, landed 200s, demo 90s, story 70s.
- Intro once per session: `sessionStorage["roam_intro"]`. Skip the intro (start landed) for repeat sessions, `prefers-reduced-motion: reduce`, `navigator.connection.saveData`, or `navigator.deviceMemory <= 2`.
- The prompt submits to `/plan?q=${encodeURIComponent(text.trim())}`, max 1500 chars. That URL contract must not change.
- Per-frame work touches only `transform`/`opacity`. No scroll listeners (IntersectionObserver only). Ticker text updates at most every 250 ms.
- Before Task 1, the working tree must be clean. The branch has pre-existing uncommitted edits (README, docs, globals.css, page.tsx, AmbientMap.tsx, mapStyle.ts); the owner decides whether to commit or stash them. Do not discard them.
- Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (per `AGENTS.md`). Used here: `01-app/02-guides/lazy-loading.md`, `01-app/02-guides/preventing-flash-before-hydration.md`.

## Review Focus

1. **Google fails after the page loads** (API disabled, key restricted, quota exhausted: `ApiNotActivatedMapError` / `gm_authFailure` / `gmp-error`). Expect: the MapLibre satellite map replaces it and the intro still completes. Pinned by Task 3 Step 7 and Task 5 Step 6.
2. **Soft navigation back to `/`** from `/plan` via a `<Link>` (the inline script does not re-run). Expect: no intro replay, no flash of the paper cover, the map starts landed. Pinned by Task 5 Step 7.
3. **Tab hidden mid-intro** (timers keep running, rAF pauses). Expect: on return the page is in a coherent landed state (no half-scaled paper stuck on screen). Pinned by Task 5 Step 8.
4. **Narrow phone (375px) stacked layout.** The demo section is taller than the viewport. Expect: the demo still starts, and the story map stays pinned above the chapters. Pinned by Task 6 Step 5 and Task 7 Step 4.
5. **Dark theme during the intro.** Expect: the letters still read as ink before the map paints and fill with the city after (the blend flips to `darken`). Pinned by Task 5 Step 9.

---

## File map

| File | Responsibility |
|---|---|
| `src/components/home/camera.ts` | `LatLng`, `Camera` types; `rangeToZoom`, `formatTicker`, `interpolate`, `routePath` (pure) |
| `src/components/home/camera.test.ts` | tests for the above |
| `src/components/home/data.ts` | all home copy, links and cameras |
| `src/components/home/diveOrigin.ts` | `deepestPoint` + `diveFrame` (pure) and `measureDiveOrigin` (DOM) |
| `src/components/home/diveOrigin.test.ts` | tests for the pure parts |
| `src/components/home/cityMap.ts` | `CityMap` interface, `chooseEngine`/`isLite` (pure), `readEnv`, `createCityMap` |
| `src/components/home/cityMap.test.ts` | tests for `chooseEngine`/`isLite` |
| `src/components/home/cityMapGoogle.ts` | Google 3D `CityMap` |
| `src/components/home/cityMapLibre.ts` | MapLibre fallback `CityMap` |
| `src/components/home/useCityMap.ts` | hook: create on demand, destroy on unmount |
| `src/components/home/visibility.ts` | `useInView`, `usePageVisible`, `usePrefersReducedMotion` |
| `src/components/home/fonts.ts` | `next/font` families → `edFonts` class string |
| `src/components/home/HomePrompt.tsx` | prompt form |
| `src/components/home/HeroStage.tsx` | hero + intro |
| `src/components/home/PlanDemo.tsx` | "Watch it plan" |
| `src/components/home/NeighborhoodStory.tsx` | scrollytelling |
| `src/components/home/Journeys.tsx`, `Colophon.tsx` | server sections |
| `src/app/home.css` | all `.ed` styles |
| `src/app/page.tsx` | rewritten: composes the sections |
| delete: `src/components/plan/LandingPrompt.tsx`, `src/components/map/AmbientMap.tsx`, `src/components/map/LazyMaps.tsx` | replaced |

---

### Task 1: Dependencies, camera helpers, content data

**Files:**
- Modify: `package.json` (via npm)
- Create: `src/components/home/camera.ts`, `src/components/home/camera.test.ts`, `src/components/home/data.ts`

**Interfaces:**
- Produces: `LatLng {lat:number; lng:number}`, `Camera extends LatLng {alt; range; tilt; heading}`, `rangeToZoom(range:number):number`, `formatTicker(lat,lng,heading):string`, `interpolate(a:LatLng,b:LatLng,steps:number):LatLng[]`, `routePath(stops:LatLng[],steps:number):LatLng[]`. From `data.ts`: `HERO {high:Camera; landed:Camera}`, `HERO_LINKS {label;query}[]`, `DEMO {sentence; overview:Camera; route:Camera; stops: DemoStop[]}`, `DemoStop extends LatLng {name; time; why; crowd:number[]; slot:number}`, `NEIGHBORHOODS Neighborhood[]` (`{numeral; name; italic; body; query; camera:Camera}`), `JOURNEYS Journey[]` (`{id; show; title; duration; query; stops:string[]}`).

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install @googlemaps/js-api-loader@^2.1.3 && npm install -D @types/google.maps@^3.66.4
```
Expected: both appear in `package.json`; `npm ls @googlemaps/js-api-loader` prints `2.1.x`.

- [ ] **Step 2: Write the failing test**

Create `src/components/home/camera.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatTicker, interpolate, rangeToZoom, routePath } from "./camera";

describe("rangeToZoom", () => {
  it("maps 400 m to zoom 16 and halves the range per zoom level", () => {
    expect(rangeToZoom(400)).toBeCloseTo(16);
    expect(rangeToZoom(1600)).toBeCloseTo(14);
  });
  it("clamps to 0..20", () => {
    expect(rangeToZoom(1)).toBe(20);
    expect(rangeToZoom(1e12)).toBe(0);
  });
});

describe("formatTicker", () => {
  it("formats hemisphere, 4 decimals and a 3-digit heading", () => {
    expect(formatTicker(40.7484, -73.9857, 30)).toBe("40.7484° N · 73.9857° W · Heading 030°");
  });
  it("normalises negative and near-360 headings", () => {
    expect(formatTicker(0, 0, -30)).toContain("Heading 330°");
    expect(formatTicker(0, 0, 359.7)).toContain("Heading 000°");
  });
});

describe("interpolate / routePath", () => {
  const a = { lat: 0, lng: 0 }, b = { lat: 1, lng: 2 }, c = { lat: 2, lng: 2 };
  it("returns `steps` points ending exactly at b, excluding a", () => {
    const pts = interpolate(a, b, 4);
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual({ lat: 0.25, lng: 0.5 });
    expect(pts[3]).toEqual(b);
  });
  it("builds a whole route starting at the first stop", () => {
    const path = routePath([a, b, c], 2);
    expect(path).toHaveLength(5);
    expect(path[0]).toEqual(a);
    expect(path.at(-1)).toEqual(c);
  });
  it("handles no stops", () => {
    expect(routePath([], 5)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/home/camera.test.ts`
Expected: FAIL, `Failed to resolve import "./camera"`.

- [ ] **Step 4: Implement `camera.ts`**

Create `src/components/home/camera.ts`:
```ts
export interface LatLng {
  lat: number;
  lng: number;
}

/** A Google-style 3D camera: look at (lat, lng, alt metres) from `range` metres away. */
export interface Camera extends LatLng {
  alt: number;
  range: number;
  tilt: number;
  heading: number;
}

/** MapLibre zoom that frames roughly what a Google 3D camera at `range` metres shows (400 m ≈ zoom 16). */
export function rangeToZoom(range: number): number {
  return Math.max(0, Math.min(20, 16 - Math.log2(range / 400)));
}

export function formatTicker(lat: number, lng: number, heading: number): string {
  const h = Math.round(((heading % 360) + 360) % 360) % 360;
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"} · Heading ${String(h).padStart(3, "0")}°`;
}

/** `steps` evenly spaced points from a (exclusive) to b (inclusive). */
export function interpolate(a: LatLng, b: LatLng, steps: number): LatLng[] {
  return Array.from({ length: steps }, (_, k) => {
    const t = (k + 1) / steps;
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  });
}

/** The whole straight-leg route through `stops`, `steps` points per leg. */
export function routePath(stops: LatLng[], steps: number): LatLng[] {
  if (!stops.length) return [];
  return [{ lat: stops[0].lat, lng: stops[0].lng }, ...stops.slice(1).flatMap((s, i) => interpolate(stops[i], s, steps))];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/home/camera.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Create `data.ts`**

Create `src/components/home/data.ts` (queries are carried over from the current `src/app/page.tsx`):
```ts
import type { Camera, LatLng } from "./camera";

export const HERO: { high: Camera; landed: Camera } = {
  high: { lat: 40.738, lng: -73.99, alt: 0, range: 9000, tilt: 0, heading: -30 },
  landed: { lat: 40.7484, lng: -73.9857, alt: 180, range: 1500, tilt: 64, heading: 30 },
};

export const HERO_LINKS = [
  { label: "The Friends walk", query: "Friends themed day in Greenwich Village: Central Perk coffee vibes, visit Monica's apartment on Bedford St, Washington Square Park fountain, and dinner at a West Village bistro." },
  { label: "Seinfeld's Upper West Side", query: "Classic Seinfeld day on the Upper West Side: Monk's Diner at Tom's Restaurant, walk Central Park West reservoir, Jerry's West 81st St neighborhood, and an evening comedy show." },
  { label: "DUMBO at dusk", query: "Explore DUMBO and Brooklyn Heights: walk across the Brooklyn Bridge, photo spot on Washington St, Jane's Carousel, and waterfront sunset." },
];

export interface DemoStop extends LatLng {
  name: string;
  time: string;
  why: string;
  /** Relative crowd level per hour, 8 bars. */
  crowd: number[];
  /** Index into `crowd` of the hour Roam picked. */
  slot: number;
}

export const DEMO: { sentence: string; overview: Camera; route: Camera; stops: DemoStop[] } = {
  sentence: "Saturday: the Met, Central Park, a skyline view and real NY pizza. We hate crowds.",
  overview: { lat: 40.756, lng: -73.978, alt: 0, range: 7200, tilt: 52, heading: -20 },
  route: { lat: 40.755, lng: -73.983, alt: 0, range: 6200, tilt: 58, heading: -29 },
  stops: [
    { name: "The Met", time: "10:00", lat: 40.7794, lng: -73.9632, why: "72% quieter than 2pm", crowd: [3, 4, 2, 5, 7, 8, 6, 4], slot: 1 },
    { name: "Bethesda Terrace", time: "12:10", lat: 40.774, lng: -73.9712, why: "a 9-minute walk", crowd: [2, 3, 5, 7, 6, 5, 4, 3], slot: 3 },
    { name: "Top of the Rock", time: "2:30", lat: 40.7593, lng: -73.9787, why: "before the sunset rush", crowd: [2, 3, 4, 5, 6, 8, 9, 7], slot: 4 },
    { name: "Joe's Pizza, Carmine St", time: "6:15", lat: 40.7306, lng: -74.0027, why: "dinner where you end up", crowd: [1, 2, 3, 4, 6, 8, 7, 5], slot: 5 },
  ],
};

export interface Neighborhood {
  numeral: string;
  name: string;
  italic: string;
  body: string;
  query: string;
  camera: Camera;
}

export const NEIGHBORHOODS: Neighborhood[] = [
  {
    numeral: "I", name: "Greenwich", italic: "Village",
    body: "Brownstones, basement comedy clubs and the Washington Square arch. Best before noon, when the park still belongs to the chess players.",
    query: "Plan an afternoon in Greenwich Village: visit Washington Square Park, iconic brownstone streets, comedy club, and a rustic Italian dinner.",
    camera: { lat: 40.7309, lng: -73.9973, alt: 30, range: 650, tilt: 62, heading: 200 },
  },
  {
    numeral: "II", name: "Upper", italic: "West Side",
    body: "Pre-war grandeur, the Natural History museum and Jerry's old block. Quietest on weekday mornings.",
    query: "Upper West Side culture tour: American Museum of Natural History, Zabar's bagels, Central Park Strawberry Fields, and Lincoln Center plaza.",
    camera: { lat: 40.7813, lng: -73.974, alt: 40, range: 900, tilt: 60, heading: 120 },
  },
  {
    numeral: "III", name: "DUMBO,", italic: "at dusk",
    body: "Cobblestones under the Manhattan Bridge. Arrive at golden hour and the skyline lights up across the river.",
    query: "Explore DUMBO and Brooklyn Heights: walk across the Brooklyn Bridge, photo spot on Washington St, Jane's Carousel, and waterfront sunset.",
    camera: { lat: 40.7033, lng: -73.9894, alt: 20, range: 700, tilt: 70, heading: 320 },
  },
  {
    numeral: "IV", name: "Midtown,", italic: "after dark",
    body: "Grand Central's whispering gallery, then Top of the Rock after 8pm, once the tour buses have gone.",
    query: "Midtown Manhattan highlights: Grand Central Terminal whispering gallery, Bryant Park library, Top of the Rock, and Broadway theater.",
    camera: { lat: 40.7484, lng: -73.9857, alt: 200, range: 1100, tilt: 68, heading: 35 },
  },
];

export interface Journey {
  id: string;
  show: string;
  title: string;
  duration: string;
  query: string;
  stops: string[];
}

export const JOURNEYS: Journey[] = [
  {
    id: "friends", show: "Friends", title: "The Greenwich Village walk", duration: "4.5 hrs",
    query: HERO_LINKS[0].query,
    stops: ["Village coffee on Bedford", "Monica's apartment, 90 Bedford St", "Washington Square fountain", "A West 4th St bistro"],
  },
  {
    id: "seinfeld", show: "Seinfeld", title: "The Upper West Side tour", duration: "5 hrs",
    query: HERO_LINKS[1].query,
    stops: ["Monk's Diner (Tom's Restaurant)", "Central Park West reservoir", "Jerry's 81st Street block", "An evening comedy show"],
  },
  {
    id: "himym", show: "How I Met Your Mother", title: "The Midtown trail", duration: "5.5 hrs",
    query: "How I Met Your Mother route: MacLaren's Pub booth at McGee's, Yellow Umbrella at Central Park South, Empire State Building deck, and Corner Bistro burger.",
    stops: ["MacLaren's (McGee's, 55th St)", "The yellow umbrella, Central Park South", "Empire State Building deck", "Corner Bistro burger"],
  },
  {
    id: "skyline", show: "New York classic", title: "High Line & skyline", duration: "6 hrs",
    query: "Plan a Saturday with Central Park, the Met, Top of the Rock and Chelsea Market. Subway and walking, 9am to 6pm.",
    stops: ["The High Line", "Chelsea Market", "Little Island at Pier 55", "Top of the Rock at sunset"],
  },
];
```

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc --noEmit -p .`
Expected: no errors from `src/components/home/*`.
```bash
git add package.json package-lock.json src/components/home/camera.ts src/components/home/camera.test.ts src/components/home/data.ts
git commit -m "feat(home): camera helpers and editorial content"
```

---

### Task 2: Dive maths (thickest stroke + zoom curve)

**Files:**
- Create: `src/components/home/diveOrigin.ts`, `src/components/home/diveOrigin.test.ts`

**Interfaces:**
- Produces: `DiveOrigin {x:number; y:number; radius:number}`, `deepestPoint(mask:ArrayLike<number>, w:number, h:number): DiveOrigin | null`, `DIVE_TIMING {pre:280; dive:1700}`, `diveFrame(t:number, cover:number): {scale:number; opacity:number; done:boolean}`, `measureDiveOrigin(word:HTMLElement, scale?:number): DiveOrigin | null` (viewport px; `word` must contain one `<i>` per glyph).

- [ ] **Step 1: Write the failing test**

Create `src/components/home/diveOrigin.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DIVE_TIMING, deepestPoint, diveFrame } from "./diveOrigin";

function mask(w: number, h: number, fill: (x: number, y: number) => boolean) {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = fill(x, y) ? 1 : 0;
  return m;
}

describe("deepestPoint", () => {
  it("picks the centre of the thickest stroke, not a thin one", () => {
    // a 2px bar at x=2..3 and a 10x10 block at x=8..17, y=5..14
    const m = mask(20, 20, (x, y) => (x >= 2 && x <= 3) || (x >= 8 && x <= 17 && y >= 5 && y <= 14));
    const p = deepestPoint(m, 20, 20)!;
    expect(p.x).toBeGreaterThanOrEqual(10);
    expect(p.x).toBeLessThanOrEqual(15);
    expect(p.y).toBeGreaterThanOrEqual(7);
    expect(p.y).toBeLessThanOrEqual(12);
    expect(p.radius).toBeGreaterThanOrEqual(4);
  });
  it("returns null for an empty mask or a zero-size box", () => {
    expect(deepestPoint(new Uint8Array(16), 4, 4)).toBeNull();
    expect(deepestPoint(new Uint8Array(0), 0, 0)).toBeNull();
  });
});

describe("diveFrame", () => {
  const cover = 10;
  it("starts at scale 1, fully opaque", () => {
    expect(diveFrame(0, cover)).toEqual({ scale: 1, opacity: 1, done: false });
  });
  it("pulls back to 0.965 at the end of the anticipation", () => {
    expect(diveFrame(DIVE_TIMING.pre, cover).scale).toBeCloseTo(0.965, 3);
  });
  it("stays opaque until the stroke covers the screen, then fades to 0", () => {
    for (let t = DIVE_TIMING.pre; t <= DIVE_TIMING.pre + DIVE_TIMING.dive; t += 50) {
      const f = diveFrame(t, cover);
      if (f.scale < cover) expect(f.opacity).toBe(1);
    }
    const end = diveFrame(DIVE_TIMING.pre + DIVE_TIMING.dive, cover);
    expect(end.scale).toBeCloseTo(cover * 2.2, 3);
    expect(end.opacity).toBe(0);
    expect(end.done).toBe(true);
  });
  it("never divides by zero for a tiny cover", () => {
    const f = diveFrame(DIVE_TIMING.pre + DIVE_TIMING.dive, 0.2);
    expect(Number.isFinite(f.scale)).toBe(true);
    expect(f.opacity).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/diveOrigin.test.ts`
Expected: FAIL, `Failed to resolve import "./diveOrigin"`.

- [ ] **Step 3: Implement `diveOrigin.ts`**

Create `src/components/home/diveOrigin.ts`:
```ts
export interface DiveOrigin {
  x: number;
  y: number;
  /** Distance from (x, y) to the nearest non-ink pixel: how wide the stroke is there. */
  radius: number;
}

/**
 * The ink pixel furthest from any paper (two-pass chamfer distance transform), weighted
 * towards the horizontal centre so the dive feels central. `mask[i]` truthy = ink.
 */
export function deepestPoint(mask: ArrayLike<number>, w: number, h: number): DiveOrigin | null {
  if (w <= 0 || h <= 0) return null;
  const INF = 1e9, D = Math.SQRT2, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + D, at(x + 1, y - 1) + D);
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + D, at(x - 1, y + 1) + D);
    }
  let best = 0, bx = -1, by = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = d[y * w + x] * (1 - 0.5 * Math.abs(x / w - 0.5));
      if (v > best) [best, bx, by] = [v, x, y];
    }
  return bx < 0 ? null : { x: bx, y: by, radius: d[by * w + bx] };
}

export const DIVE_TIMING = { pre: 280, dive: 1700 } as const;

const easeInOutCubic = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

/**
 * Scale and opacity of the paper layer `t` ms into the dive. A small pull-back, then an
 * exponential zoom (reads as constant camera speed). `cover` is the scale at which the
 * stroke fills the screen: the paper stays opaque until then, then fades.
 */
export function diveFrame(t: number, cover: number): { scale: number; opacity: number; done: boolean } {
  const { pre, dive } = DIVE_TIMING;
  const base = 0.965, c = Math.max(cover, 1.5), end = c * 2.2;
  if (t < pre) return { scale: 1 - (1 - base) * Math.sin((Math.PI / 2) * (t / pre)), opacity: 1, done: false };
  const u = Math.min(1, (t - pre) / dive);
  const scale = base * Math.pow(end / base, easeInOutCubic(u));
  const opacity = scale < c ? 1 : Math.max(0, 1 - Math.log(scale / c) / Math.log(end / c));
  return { scale, opacity, done: u >= 1 };
}

/**
 * Rasterise the knockout word (one `<i>` per glyph, so letter-spacing is exact) at
 * `scale` and find its thickest stroke, in viewport pixels. Call after
 * `document.fonts.ready` and before the word is transformed.
 */
export function measureDiveOrigin(word: HTMLElement, scale = 0.25): DiveOrigin | null {
  const box = word.getBoundingClientRect();
  const W = Math.ceil(box.width * scale), H = Math.ceil(box.height * scale);
  if (W < 2 || H < 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const cx = canvas.getContext("2d", { willReadFrequently: true });
  if (!cx) return null;
  const cs = getComputedStyle(word);
  cx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * scale}px ${cs.fontFamily}`;
  cx.textBaseline = "alphabetic";
  for (const glyph of word.querySelectorAll("i")) {
    const ch = glyph.textContent ?? "";
    if (!ch.trim()) continue;
    const r = glyph.getBoundingClientRect(), m = cx.measureText(ch);
    // CSS centres the font's content area in the line box, so the baseline sits here:
    const baseline = (r.top - box.top) * scale + (r.height * scale + m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
    cx.fillText(ch, (r.left - box.left) * scale, baseline);
  }
  const px = cx.getImageData(0, 0, W, H).data, mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] > 128 ? 1 : 0;
  const p = deepestPoint(mask, W, H);
  return p && { x: box.left + p.x / scale, y: box.top + p.y / scale, radius: p.radius / scale };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/home/diveOrigin.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/diveOrigin.ts src/components/home/diveOrigin.test.ts
git commit -m "feat(home): thickest-stroke finder and dive curve"
```

---

### Task 3: CityMap engines (Google 3D + MapLibre fallback) and hooks

**Files:**
- Create: `src/components/home/cityMap.ts`, `src/components/home/cityMap.test.ts`, `src/components/home/cityMapGoogle.ts`, `src/components/home/cityMapLibre.ts`, `src/components/home/useCityMap.ts`, `src/components/home/visibility.ts`

**Interfaces:**
- Consumes: `Camera`, `LatLng`, `rangeToZoom` (Task 1); `SATELLITE_3D_STYLE`, `ensureWorker`, `resolveMissingStyleImages` from `@/components/map/mapStyle` (existing).
- Produces:
  - `interface CityMap { readonly engine: "google" | "maplibre"; jumpTo(c: Camera): void; flyTo(c: Camera, ms: number): Promise<void>; orbit(c: Camera, secondsPerTurn: number): void; stop(): void; onMove(cb: (lat: number, lng: number, heading: number) => void): () => void; setRoute(points: LatLng[]): void; addPin(p: LatLng, label: string): void; clearOverlays(): void; destroy(): void }`
  - `type MapRole = "hero" | "secondary"`, `interface EngineEnv { hasKey: boolean; webgl: boolean; saveData: boolean; deviceMemory: number | undefined }`, `isLite(env): boolean`, `chooseEngine(env, role): "google" | "maplibre" | "none"`, `readEnv(): EngineEnv`, `createCityMap(host: HTMLElement, cam: Camera, role: MapRole): Promise<CityMap | null>`. Resolves once the map has painted (or after 8 s).
  - `useCityMap(host: RefObject<HTMLElement | null>, initial: Camera, role: MapRole, enabled?: boolean): { map: CityMap | null; failed: boolean }`
  - `useInView(ref, opts?: { rootMargin?: string; once?: boolean }): boolean`, `usePageVisible(): boolean`, `usePrefersReducedMotion(): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/components/home/cityMap.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { chooseEngine, isLite, type EngineEnv } from "./cityMap";

const good: EngineEnv = { hasKey: true, webgl: true, saveData: false, deviceMemory: 8 };

describe("chooseEngine", () => {
  it("uses Google 3D when a key and WebGL are available", () => {
    expect(chooseEngine(good, "hero")).toBe("google");
    expect(chooseEngine(good, "secondary")).toBe("google");
  });
  it("falls back to MapLibre without a key", () => {
    expect(chooseEngine({ ...good, hasKey: false }, "hero")).toBe("maplibre");
  });
  it("renders no map at all without WebGL", () => {
    expect(chooseEngine({ ...good, webgl: false }, "hero")).toBe("none");
  });
  it("keeps Google for the hero but not secondary maps on lite devices", () => {
    const saver = { ...good, saveData: true };
    expect(chooseEngine(saver, "hero")).toBe("google");
    expect(chooseEngine(saver, "secondary")).toBe("maplibre");
    expect(chooseEngine({ ...good, deviceMemory: 2 }, "secondary")).toBe("maplibre");
  });
});

describe("isLite", () => {
  it("is true for data saver or ≤2 GB memory, false when memory is unknown", () => {
    expect(isLite({ ...good, saveData: true })).toBe(true);
    expect(isLite({ ...good, deviceMemory: 2 })).toBe(true);
    expect(isLite({ ...good, deviceMemory: undefined })).toBe(false);
    expect(isLite(good)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/cityMap.test.ts`
Expected: FAIL, `Failed to resolve import "./cityMap"`.

- [ ] **Step 3: Implement `cityMap.ts`**

Create `src/components/home/cityMap.ts`:
```ts
import type { Camera, LatLng } from "./camera";

/** One map, whichever engine draws it. Components only ever talk to this. */
export interface CityMap {
  readonly engine: "google" | "maplibre";
  jumpTo(c: Camera): void;
  /** Resolves when the flight ends (or is interrupted). */
  flyTo(c: Camera, ms: number): Promise<void>;
  orbit(c: Camera, secondsPerTurn: number): void;
  stop(): void;
  onMove(cb: (lat: number, lng: number, heading: number) => void): () => void;
  setRoute(points: LatLng[]): void;
  addPin(p: LatLng, label: string): void;
  clearOverlays(): void;
  destroy(): void;
}

export type MapRole = "hero" | "secondary";

export interface EngineEnv {
  hasKey: boolean;
  webgl: boolean;
  saveData: boolean;
  deviceMemory: number | undefined;
}

export const isLite = (env: EngineEnv) => env.saveData || (env.deviceMemory !== undefined && env.deviceMemory <= 2);

export function chooseEngine(env: EngineEnv, role: MapRole): "google" | "maplibre" | "none" {
  if (!env.webgl) return "none";
  if (!env.hasKey) return "maplibre";
  if (role === "secondary" && isLite(env)) return "maplibre";
  return "google";
}

let webgl: boolean | undefined;
export function readEnv(): EngineEnv {
  if (webgl === undefined) {
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      webgl = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext(); // hand the context back
    } catch {
      webgl = false;
    }
  }
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  return {
    hasKey: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    webgl,
    saveData: !!nav.connection?.saveData,
    deviceMemory: nav.deviceMemory,
  };
}

// Once Google has failed on this page, later maps go straight to the fallback.
let googleBroken = false;

/** Build a map in `host` and resolve once it has painted. Engines load on demand. */
export async function createCityMap(host: HTMLElement, cam: Camera, role: MapRole): Promise<CityMap | null> {
  const engine = chooseEngine(readEnv(), role);
  if (engine === "none") return null;
  if (engine === "google" && !googleBroken) {
    try {
      const { createGoogleMap } = await import("./cityMapGoogle");
      return await createGoogleMap(host, cam);
    } catch (err) {
      console.warn("Google 3D map unavailable, using the satellite fallback.", err);
      googleBroken = true;
    }
  }
  const { createLibreMap } = await import("./cityMapLibre");
  return createLibreMap(host, cam);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/home/cityMap.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Implement the two engines**

Create `src/components/home/cityMapGoogle.ts`:
```ts
"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { Camera } from "./camera";
import type { CityMap } from "./cityMap";

// `beta`, not `alpha`: in alpha every maps3d overlay constructor throws (checked 2026-09-26).
let configured = false;
function configure() {
  if (configured) return;
  configured = true;
  setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "", v: "beta" });
}

// Google reports key/API problems (e.g. ApiNotActivatedMapError) through this global.
let authFailed = false;
const authListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  (window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
    authFailed = true;
    authListeners.forEach((f) => f());
  };
}

const toCam = (c: Camera) => ({
  center: { lat: c.lat, lng: c.lng, altitude: c.alt },
  range: c.range,
  tilt: c.tilt,
  heading: c.heading,
});

export async function createGoogleMap(host: HTMLElement, cam: Camera): Promise<CityMap> {
  if (authFailed) throw new Error("Google Maps rejected the key");
  configure();
  const { Map3DElement, MapMode, Polyline3DElement, Marker3DElement } = await importLibrary("maps3d");
  const map = new Map3DElement({ ...toCam(cam), mode: MapMode.SATELLITE, defaultUIHidden: true });
  map.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  host.append(map);

  // Ready = first steady frame. Failure = gmp-error or an auth failure. Slow = give up waiting at 8 s.
  await new Promise<void>((resolve, reject) => {
    const finish = (fn: () => void) => {
      clearTimeout(timer);
      map.removeEventListener("gmp-steadychange", onSteady);
      map.removeEventListener("gmp-error", onError);
      authListeners.delete(onError);
      fn();
    };
    const onSteady = (e: Event) => {
      if ((e as google.maps.maps3d.SteadyChangeEvent).isSteady) finish(resolve);
    };
    const onError = () => finish(() => {
      map.remove();
      reject(new Error("Google 3D map failed to load"));
    });
    const timer = setTimeout(() => finish(resolve), 8000);
    map.addEventListener("gmp-steadychange", onSteady);
    map.addEventListener("gmp-error", onError);
    authListeners.add(onError);
  });

  let line: google.maps.maps3d.Polyline3DElement | null = null;
  const pins: HTMLElement[] = [];
  return {
    engine: "google",
    jumpTo(c) {
      map.stopCameraAnimation();
      Object.assign(map, toCam(c));
    },
    flyTo(c, ms) {
      map.stopCameraAnimation();
      return new Promise((resolve) => {
        map.addEventListener("gmp-animationend", () => resolve(), { once: true });
        map.flyCameraTo({ endCamera: toCam(c), durationMillis: ms });
      });
    },
    orbit(c, secondsPerTurn) {
      map.stopCameraAnimation();
      map.flyCameraAround({ camera: toCam(c), durationMillis: secondsPerTurn * 1000, repeatCount: Infinity });
    },
    stop: () => map.stopCameraAnimation(),
    onMove(cb) {
      const f = () => {
        const c = map.center;
        if (c) cb(c.lat, c.lng, map.heading ?? 0);
      };
      map.addEventListener("gmp-headingchange", f);
      return () => map.removeEventListener("gmp-headingchange", f);
    },
    setRoute(points) {
      if (!line) {
        line = new Polyline3DElement({
          strokeColor: "#c8321f", strokeWidth: 7, outerColor: "#ffffff", outerWidth: 0.5,
          altitudeMode: "CLAMP_TO_GROUND", drawsOccludedSegments: true,
        });
        map.append(line);
      }
      line.path = points.map((p) => ({ lat: p.lat, lng: p.lng })); // a fresh array, or Google may not redraw
    },
    addPin(p, label) {
      const pin = new Marker3DElement({ position: { lat: p.lat, lng: p.lng, altitude: 60 }, altitudeMode: "RELATIVE_TO_GROUND", extruded: true, label });
      map.append(pin);
      pins.push(pin);
    },
    clearOverlays() {
      line?.remove();
      line = null;
      pins.splice(0).forEach((p) => p.remove());
    },
    destroy() {
      map.stopCameraAnimation();
      map.remove();
    },
  };
}
```

Create `src/components/home/cityMapLibre.ts`:
```ts
"use client";

import { Map as MapLibre, Marker, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SATELLITE_3D_STYLE, ensureWorker, resolveMissingStyleImages } from "@/components/map/mapStyle";
import { rangeToZoom, type Camera, type LatLng } from "./camera";
import type { CityMap } from "./cityMap";

const view = (c: Camera) => ({
  center: [c.lng, c.lat] as [number, number],
  zoom: rangeToZoom(c.range),
  pitch: Math.min(c.tilt, 60),
  bearing: c.heading,
});

const ROUTE = "roam-route";

export async function createLibreMap(host: HTMLElement, cam: Camera): Promise<CityMap> {
  ensureWorker();
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;inset:0";
  host.append(el);
  const map = new MapLibre({
    container: el, style: SATELLITE_3D_STYLE, ...view(cam), maxPitch: 60,
    interactive: false, attributionControl: { compact: true }, fadeDuration: 0,
  });
  resolveMissingStyleImages(map);
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 8000);
    map.once("idle", () => {
      clearTimeout(timer);
      resolve();
    });
  });

  let raf = 0;
  const stop = () => {
    cancelAnimationFrame(raf);
    map.stop();
  };
  const markers: Marker[] = [];
  const line = (points: LatLng[]) => ({
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: points.map((p) => [p.lng, p.lat]) },
  });

  return {
    engine: "maplibre",
    jumpTo(c) {
      stop();
      map.jumpTo(view(c));
    },
    flyTo(c, ms) {
      stop();
      return new Promise((resolve) => {
        map.once("moveend", () => resolve());
        map.flyTo({ ...view(c), duration: ms, essential: true });
      });
    },
    orbit(_c, secondsPerTurn) {
      stop();
      const degPerMs = 360 / (secondsPerTurn * 1000);
      let last = performance.now();
      const step = (now: number) => {
        map.setBearing(map.getBearing() + Math.min(64, now - last) * degPerMs);
        last = now;
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    },
    stop,
    onMove(cb) {
      const f = () => {
        const c = map.getCenter();
        cb(c.lat, c.lng, map.getBearing());
      };
      map.on("move", f);
      return () => map.off("move", f);
    },
    setRoute(points) {
      const source = map.getSource(ROUTE) as GeoJSONSource | undefined;
      if (source) return source.setData(line(points));
      map.addSource(ROUTE, { type: "geojson", data: line(points) });
      const layout = { "line-cap": "round" as const, "line-join": "round" as const };
      map.addLayer({ id: `${ROUTE}-casing`, type: "line", source: ROUTE, paint: { "line-color": "#fff", "line-width": 8 }, layout });
      map.addLayer({ id: ROUTE, type: "line", source: ROUTE, paint: { "line-color": "#c8321f", "line-width": 4.5 }, layout });
    },
    addPin(p, label) {
      const pin = document.createElement("div");
      pin.className = "ed-pin";
      pin.textContent = label.split(" · ")[0];
      pin.title = label;
      markers.push(new Marker({ element: pin }).setLngLat([p.lng, p.lat]).addTo(map));
    },
    clearOverlays() {
      markers.splice(0).forEach((m) => m.remove());
      if (map.getLayer(ROUTE)) {
        map.removeLayer(ROUTE);
        map.removeLayer(`${ROUTE}-casing`);
        map.removeSource(ROUTE);
      }
    },
    destroy() {
      stop();
      map.remove();
      el.remove();
    },
  };
}
```

- [ ] **Step 6: Implement the hooks**

Create `src/components/home/visibility.ts`:
```ts
"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

/** Whether `ref` intersects the viewport (grown by `rootMargin`). With `once`, it latches true. */
export function useInView(ref: RefObject<Element | null>, { rootMargin = "0px", once = false }: { rootMargin?: string; once?: boolean } = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (once && entry.isIntersecting) io.disconnect();
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, once]);
  return inView;
}

const onVisibility = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};
export const usePageVisible = () =>
  useSyncExternalStore(onVisibility, () => document.visibilityState === "visible", () => true);

const REDUCE = "(prefers-reduced-motion: reduce)";
const onReduce = (cb: () => void) => {
  const mql = matchMedia(REDUCE);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
};
export const usePrefersReducedMotion = () =>
  useSyncExternalStore(onReduce, () => matchMedia(REDUCE).matches, () => false);
```

Create `src/components/home/useCityMap.ts`:
```ts
"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Camera } from "./camera";
import { createCityMap, type CityMap, type MapRole } from "./cityMap";

/**
 * Create a map in `host` once `enabled` turns true; destroy it on unmount. `map` is set
 * after the map has painted. `failed` means no map could be drawn at all.
 */
export function useCityMap(host: RefObject<HTMLElement | null>, initial: Camera, role: MapRole, enabled = true) {
  const [state, setState] = useState<{ map: CityMap | null; failed: boolean }>({ map: null, failed: false });
  useEffect(() => {
    const el = host.current;
    if (!enabled || !el) return;
    let live = true;
    let made: CityMap | null = null;
    createCityMap(el, initial, role).then(
      (m) => {
        if (!live) return m?.destroy();
        made = m;
        setState({ map: m, failed: !m });
      },
      () => live && setState({ map: null, failed: true }),
    );
    return () => {
      live = false;
      made?.destroy();
    };
  }, [host, initial, role, enabled]);
  return state;
}
```

- [ ] **Step 7: Verify (types, lint, tests) and commit**

Run: `npx tsc --noEmit -p . && npx eslint src/components/home && npx vitest run src/components/home`
Expected: no type or lint errors; 18 tests pass.
(Runtime behaviour, including the forced-failure fallback, is checked in Task 5 Step 6, where the first map is on screen.)
```bash
git add src/components/home/cityMap.ts src/components/home/cityMap.test.ts src/components/home/cityMapGoogle.ts src/components/home/cityMapLibre.ts src/components/home/useCityMap.ts src/components/home/visibility.ts
git commit -m "feat(home): CityMap with Google 3D and MapLibre fallback"
```

---

### Task 4: Page shell, fonts, styles, prompt and static sections

This task replaces the home page with the new static page (no maps yet: the hero shows ink letters on paper). The site keeps working at every commit.

**Files:**
- Create: `src/components/home/fonts.ts`, `src/components/home/HomePrompt.tsx`, `src/components/home/Journeys.tsx`, `src/components/home/Colophon.tsx`, `src/app/home.css`
- Create (placeholder islands, filled in Tasks 5–7): `src/components/home/HeroStage.tsx`, `src/components/home/PlanDemo.tsx`, `src/components/home/NeighborhoodStory.tsx`
- Rewrite: `src/app/page.tsx`

**Interfaces:**
- Consumes: `JOURNEYS`, `HERO_LINKS` (Task 1), `BRAND` from `@/lib/plan/display`, `ThemeToggle` from `@/components/theme/ThemeToggle`.
- Produces: `edFonts: string`, `<HomePrompt />`, `<Journeys />`, `<Colophon />`, and the CSS class contract used by Tasks 5–7 (all in `home.css` below).

- [ ] **Step 1: Fonts**

Create `src/components/home/fonts.ts`:
```ts
import { IBM_Plex_Mono, Instrument_Serif, Newsreader } from "next/font/google";

// Loaded here, not in the root layout, so only the home page downloads them.
const display = Instrument_Serif({ variable: "--ed-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });
const text = Newsreader({ variable: "--ed-text", subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], display: "swap" });
const mono = IBM_Plex_Mono({ variable: "--ed-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const edFonts = `${display.variable} ${text.variable} ${mono.variable}`;
```

- [ ] **Step 2: Styles**

Create `src/app/home.css`:
```css
/* Home page, "Editorial × 3D Manhattan". Everything is scoped under .ed so the
   planner's shared tokens in globals.css are untouched. */

.ed {
  --paper: #f3ede1;
  --ink: #15120e;
  --muted: #6d6457;
  --rule: var(--ink);
  --red: #c8321f;
  --night: #1c1a17;
  --on-map: #f3ede1;
  --gut: clamp(16px, 4vw, 64px);
  --f-display: var(--ed-display), Georgia, serif;
  --f-text: var(--ed-text), Georgia, serif;
  --f-mono: var(--ed-mono), ui-monospace, monospace;
  width: 100%;
  min-height: 100dvh;
  overflow-x: clip;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--f-text);
}
.dark .ed {
  --paper: #1a1815;
  --ink: #efe8da;
  --muted: #a39a8b;
  --rule: rgba(239, 232, 218, 0.35);
  --red: #e0543f;
}

/* Paper grain: a static background on paper sections only. Never a fixed, blended overlay,
   which would force blending over the WebGL canvases every frame. */
.ed-paper {
  background-color: var(--paper);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.ed-display { font-family: var(--f-display); font-weight: 400; }
.ed-mono { font: 500 11px/1.4 var(--f-mono); letter-spacing: 0.14em; text-transform: uppercase; }
.ed-kicker { color: var(--red); }
.ed-gut { padding-inline: var(--gut); }
.ed a { color: inherit; }
.ed-h2 { font-family: var(--f-display); font-weight: 400; font-size: clamp(40px, 4.6vw, 76px); line-height: 0.92; margin: 10px 0 18px; }

.ed-btn {
  display: inline-flex; align-items: center; gap: 6px; border: 0; cursor: pointer; text-decoration: none;
  background: var(--ink); color: var(--paper); padding: 10px 16px;
  font: 500 11px/1 var(--f-mono); letter-spacing: 0.14em; text-transform: uppercase;
}
.ed-btn:focus-visible, .ed-navlink:focus-visible, .ed-entry:focus-visible { outline: 2px solid var(--red); outline-offset: 3px; }
.ed-btn:disabled { opacity: 0.6; cursor: default; }
.ed-btn--ghost { background: none; color: var(--ink); border: 1.5px solid var(--ink); }

.ed-prompt {
  display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 16px;
  background: #fffdf8; color: #15120e; border: 1.5px solid #15120e; box-shadow: 6px 6px 0 #15120e;
}
.ed-prompt input { flex: 1; min-width: 0; border: 0; outline: none; background: none; color: inherit; font: 18px var(--f-text); }
.ed-prompt .ed-btn { background: #15120e; color: #f3ede1; }
.ed-prompt:focus-within { box-shadow: 6px 6px 0 var(--red); }

.ed-chips { display: flex; flex-wrap: wrap; gap: 14px; margin: 14px 0 0; padding: 0; list-style: none; font-style: italic; font-size: 15px; }
.ed-chips a { text-decoration: none; border-bottom: 1px solid currentColor; }

.ed-bullet {
  display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%;
  background: var(--red); color: #fff; font: 600 12px/1 var(--f-mono);
}
.ed-pin {
  width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
  background: #c8321f; color: #fff; font: 600 13px/1 var(--f-mono); border: 2.5px solid #fff; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.ed-map-host { position: absolute; inset: 0; }

@keyframes ed-rise { to { opacity: 1; transform: none; } }

/* ── Hero ─────────────────────────────────────────────── */
.ed-hero {
  position: relative; height: 100dvh; min-height: 620px; overflow: hidden;
  display: flex; flex-direction: column; background: var(--night);
}
/* Dark theme: the knockout uses `darken`, so what shows through the letters before the map
   paints must be light. */
.dark .ed-hero { background: var(--ink); }
.ed-hero-map { position: absolute; inset: 0; opacity: 0; transition: opacity 0.9s ease; }
.ed-hero.city .ed-hero-map, [data-intro="skip"] .ed-hero-map { opacity: 1; }

.ed-knock {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  display: flex; align-items: center; justify-content: center;
  background: var(--paper); mix-blend-mode: lighten;
}
.dark .ed-knock { mix-blend-mode: darken; }
.ed-knock-word {
  font-family: var(--f-display); font-style: italic; color: #000;
  font-size: 25vw; line-height: 0.8; letter-spacing: -0.035em; white-space: nowrap;
}
.dark .ed-knock-word { color: #fff; }
.ed-knock-word i { display: inline-block; font-style: inherit; }
.ed-hero.dive .ed-knock { will-change: transform, opacity; }
.ed-hero.landed .ed-knock, [data-intro="skip"] .ed-knock { display: none; }

.ed-scrim {
  position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: 0; transition: opacity 1.4s;
  background: linear-gradient(180deg, rgba(12, 10, 8, 0.7) 0%, rgba(12, 10, 8, 0) 26%, rgba(12, 10, 8, 0) 48%, rgba(12, 10, 8, 0.8) 100%);
}
.ed-hero.revealed .ed-scrim, [data-intro="skip"] .ed-scrim { opacity: 1; }

.ed-chrome { position: relative; z-index: 3; color: var(--ink); transition: color 1s, border-color 1s; }
.ed-hero.revealed .ed-chrome, [data-intro="skip"] .ed-chrome,
.ed-hero.revealed .ed-chrome .ed-kicker, [data-intro="skip"] .ed-chrome .ed-kicker { color: var(--on-map); }

.ed-header {
  display: flex; justify-content: space-between; align-items: end; gap: 16px;
  margin: 0 var(--gut); padding: 18px 0 10px; border-bottom: 1px solid currentColor;
}
.ed-wordmark { font-size: 30px; line-height: 1; text-decoration: none; }
.ed-header nav { display: flex; align-items: center; gap: 22px; }
.ed-navlink { text-decoration: none; }
.ed-hero.revealed .ed-header .ed-btn, [data-intro="skip"] .ed-header .ed-btn { background: var(--on-map); color: #15120e; }
.ed .ed-theme.neo-control { background: transparent; box-shadow: none; border: 1px solid currentColor; border-radius: 0; color: inherit; }

.ed-eyebrow { display: flex; justify-content: space-between; margin-top: 10px; }
.ed-ticker {
  position: absolute; z-index: 3; right: var(--gut); top: 50%; transform: translateY(-50%);
  writing-mode: vertical-rl; opacity: 0.8;
}

.ed-deck {
  position: relative; z-index: 3; margin-top: auto; padding-bottom: 44px; /* keeps Google's logo clear */
  display: grid; grid-template-columns: 1fr minmax(320px, 520px); gap: 32px; align-items: end;
}
.ed-hero-title { margin: 0; }
.ed-solid {
  display: block; margin: 0 0 6px; color: var(--on-map); white-space: nowrap;
  font-size: clamp(64px, 11vw, 190px); line-height: 0.82; letter-spacing: -0.035em;
  text-shadow: 0 2px 30px rgba(0, 0, 0, 0.3);
}
.ed-solid i { display: inline-block; font-style: normal; opacity: 0; transform: translateY(45%); }
.ed-hero.zoomed .ed-solid i { animation: ed-rise 1s cubic-bezier(0.2, 0.7, 0.1, 1) forwards; }
[data-intro="skip"] .ed-solid i { opacity: 1; transform: none; }
.ed-tagline { display: block; font-size: clamp(28px, 3.4vw, 52px); line-height: 1; color: var(--on-map); }
.ed-hero .ed-chips { color: var(--on-map); }

.ed-late { opacity: 0; transform: translateY(14px); transition: opacity 0.9s, transform 0.9s cubic-bezier(0.2, 0.7, 0.1, 1); }
.ed-late--2 { transition-delay: 0.15s; }
.ed-hero.landed .ed-late, [data-intro="skip"] .ed-late { opacity: 1; transform: none; }

.ed-caption { position: absolute; z-index: 3; left: 50%; bottom: 12px; transform: translateX(-50%); color: rgba(243, 237, 225, 0.7); }
.ed-replay { position: absolute; z-index: 4; right: var(--gut); bottom: 10px; background: none; border: 0; color: var(--on-map); opacity: 0.7; cursor: pointer; }

/* ── Watch it plan ────────────────────────────────────── */
.ed-demo { display: grid; grid-template-columns: minmax(340px, 0.8fr) 1.2fr; min-height: 100dvh; border-top: 3px double var(--rule); }
.ed-demo-copy { padding-top: 56px; padding-bottom: 40px; display: flex; flex-direction: column; }
.ed-typed { flex: 1; min-height: 1.4em; font-size: 18px; }
.ed-typed::after { content: "▍"; color: #c8321f; animation: ed-blink 1s steps(1) infinite; }
@keyframes ed-blink { 50% { opacity: 0; } }
.ed-itin { margin: 26px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--rule); }
.ed-row {
  display: grid; grid-template-columns: 28px 64px 1fr auto; gap: 12px; align-items: center; padding: 12px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
  opacity: 0; transform: translateX(-12px); transition: opacity 0.5s, transform 0.5s cubic-bezier(0.2, 0.7, 0.1, 1);
}
.ed-row.on { opacity: 1; transform: none; }
.ed-row-time { font: 500 12px var(--f-mono); }
.ed-row-name { font-size: 20px; }
.ed-row-why { font-style: italic; color: var(--muted); font-size: 14px; }
.ed-crowd { display: flex; align-items: end; gap: 2px; height: 18px; }
.ed-crowd b { width: 4px; background: var(--ink); opacity: 0.25; }
.ed-crowd b.on { background: var(--red); opacity: 1; }
.ed-demo-replay { margin-top: 18px; align-self: start; }
.ed-demo-map { position: relative; overflow: hidden; background: var(--night); border-left: 1px solid var(--rule); }
.ed-callout {
  position: absolute; z-index: 3; left: 20px; bottom: 44px; padding: 14px 18px; opacity: 0; transition: opacity 0.6s;
  background: var(--paper); border: 1.5px solid var(--ink); box-shadow: 6px 6px 0 var(--ink);
}
.ed-callout.on { opacity: 1; }
.ed-callout strong { display: block; font: 400 34px/1 var(--f-display); }
.ed-callout em { color: var(--muted); }

/* ── Neighborhoods ────────────────────────────────────── */
.ed-story { display: grid; grid-template-columns: minmax(340px, 0.8fr) 1.2fr; border-top: 3px double var(--rule); }
.ed-chapter {
  min-height: 95vh; display: flex; flex-direction: column; justify-content: center; padding-block: 40px;
  opacity: 0.25; transition: opacity 0.5s;
}
.ed-chapter.active { opacity: 1; }
.ed-chapter h3 { font-family: var(--f-display); font-weight: 400; font-size: clamp(44px, 5vw, 84px); line-height: 0.9; margin: 10px 0 14px; }
.ed-chapter p { font-size: 19px; line-height: 1.45; max-width: 34ch; margin: 0 0 18px; }
.ed-sticky { position: sticky; top: 0; height: 100dvh; overflow: hidden; background: var(--night); border-left: 1px solid var(--rule); }
.ed-sticky-label { position: absolute; z-index: 3; top: 20px; right: 20px; padding: 8px 12px; background: #15120e; color: #f3ede1; }

/* ── Journeys ─────────────────────────────────────────── */
.ed-journeys { padding-block: 72px; border-top: 3px double var(--rule); }
.ed-contents { margin: 24px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--rule); }
.ed-entry {
  display: grid; grid-template-columns: 80px 1fr auto; gap: 24px; align-items: baseline;
  padding: 24px 0; border-bottom: 1px solid var(--rule); text-decoration: none;
}
.ed-entry-no { font-size: 48px; line-height: 1; color: var(--red); }
.ed-entry h3 { font-family: var(--f-display); font-weight: 400; font-size: clamp(28px, 3vw, 44px); line-height: 1; margin: 6px 0 10px; }
.ed-entry-stops { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; padding: 0; list-style: none; color: var(--muted); font-style: italic; }
.ed-entry-stops li { display: inline-flex; align-items: center; gap: 8px; }
.ed-entry-stops .ed-bullet { width: 20px; height: 20px; font-size: 10px; font-style: normal; }
.ed-entry-go { transition: transform 0.2s; }
.ed-entry:hover .ed-entry-go { transform: translateX(4px); color: var(--red); }

/* ── Colophon ─────────────────────────────────────────── */
.ed-colophon { padding-block: 48px 32px; border-top: 3px double var(--rule); display: grid; gap: 12px; }
.ed-colophon-mark { font-size: 44px; line-height: 1; }
.ed-colophon p { margin: 0; max-width: 60ch; }
.ed-colophon nav { display: flex; gap: 22px; }

@media (max-width: 900px) {
  .ed-deck, .ed-demo, .ed-story { grid-template-columns: 1fr; }
  .ed-knock-word { font-size: 30vw; }
  .ed-navlink, .ed-ticker, .ed-caption { display: none; }
  .ed-demo-map { min-height: 60vh; border-left: 0; border-top: 1px solid var(--rule); }
  .ed-sticky { height: 50vh; order: -1; z-index: 5; border-left: 0; }
  .ed-chapter { min-height: 70vh; }
  .ed-entry { grid-template-columns: 48px 1fr; }
  .ed-entry-go { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .ed *, .ed *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 3: Prompt**

Create `src/components/home/HomePrompt.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

export function HomePrompt() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    startTransition(() => router.push(`/plan?q=${encodeURIComponent(q)}`));
  }

  return (
    <form className="ed-prompt" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor="home-prompt">Describe your day in New York</label>
      <input
        id="home-prompt"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1500}
        autoComplete="off"
        placeholder="A Saturday with the Met, a skyline view and pizza…"
      />
      <button type="submit" className="ed-btn" disabled={pending || !text.trim()}>
        {pending ? "Planning…" : "Plan →"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Server sections**

Create `src/components/home/Journeys.tsx`:
```tsx
import Link from "next/link";
import { JOURNEYS } from "./data";

export function Journeys() {
  return (
    <section id="journeys" className="ed-journeys ed-paper ed-gut" aria-labelledby="journeys-title">
      <span className="ed-mono ed-kicker">Contents</span>
      <h2 id="journeys-title" className="ed-h2">Four days, <i>already planned.</i></h2>
      <ol className="ed-contents">
        {JOURNEYS.map((j, i) => (
          <li key={j.id}>
            <Link href={{ pathname: "/plan", query: { q: j.query } }} className="ed-entry">
              <span className="ed-entry-no ed-display">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <span className="ed-mono ed-kicker">{j.show} · {j.duration}</span>
                <h3>{j.title}</h3>
                <ol className="ed-entry-stops">
                  {j.stops.map((s, k) => (
                    <li key={s}><span className="ed-bullet">{k + 1}</span>{s}</li>
                  ))}
                </ol>
              </div>
              <span className="ed-entry-go ed-mono">Plan this day →</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

Create `src/components/home/Colophon.tsx`:
```tsx
import Link from "next/link";
import { BRAND } from "@/lib/plan/display";

export function Colophon() {
  return (
    <footer className="ed-colophon ed-paper ed-gut">
      <span className="ed-colophon-mark ed-display">{BRAND.name}</span>
      <p>A day in New York, planned around the subway, the opening hours and the quiet hours.</p>
      <p className="ed-mono">
        Maps: Google Maps Platform, OpenStreetMap, Esri · Crowds: MTA subway ridership (data.ny.gov) · Weather: Open-Meteo · Photos: Wikimedia Commons
      </p>
      <nav className="ed-mono" aria-label="Footer">
        <Link href="/plan">Planner</Link>
        <a href="#top">Back to top</a>
      </nav>
    </footer>
  );
}
```

- [ ] **Step 5: Placeholder islands**

These three files are filled in by Tasks 5–7. For now they render only their static markup, so the page is complete without maps.

Create `src/components/home/HeroStage.tsx`:
```tsx
"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { formatTicker } from "./camera";
import { HERO, HERO_LINKS } from "./data";
import { HomePrompt } from "./HomePrompt";

const WORD = "New York";
const glyphs = (stagger: number) =>
  [...WORD].map((c, i) => (
    <i key={i} style={stagger ? { animationDelay: `${i * stagger}s` } : undefined}>{c === " " ? " " : c}</i>
  ));

export function HeroStage() {
  return (
    <section id="top" className="ed-hero" aria-labelledby="hero-title">
      <div className="ed-hero-map" />
      <div className="ed-knock" aria-hidden>
        <span className="ed-knock-word">{glyphs(0)}</span>
      </div>
      <div className="ed-scrim" aria-hidden />
      <header className="ed-header ed-chrome">
        <Link href="/" className="ed-wordmark ed-display">Roam</Link>
        <nav className="ed-mono" aria-label="Sections">
          <a href="#watch" className="ed-navlink">How it works</a>
          <a href="#neighborhoods" className="ed-navlink">Neighborhoods</a>
          <a href="#journeys" className="ed-navlink">Journeys</a>
          <ThemeToggle className="ed-theme" />
          <Link href="/plan" className="ed-btn">Open planner →</Link>
        </nav>
      </header>
      <div className="ed-eyebrow ed-gut ed-mono ed-chrome">
        <span className="ed-kicker">The day planner · Vol. I</span>
        <span>New York, N.Y. · Late city edition</span>
      </div>
      <span className="ed-ticker ed-mono ed-chrome" aria-hidden>
        {formatTicker(HERO.high.lat, HERO.high.lng, HERO.high.heading)}
      </span>
      <div className="ed-deck ed-gut">
        <h1 id="hero-title" className="ed-hero-title" aria-label="New York. See it all. Skip the crowds.">
          <span className="ed-solid ed-display">{glyphs(0.06)}</span>
          <span className="ed-tagline ed-display ed-late">See it all. <i>Skip the crowds.</i></span>
        </h1>
        <div className="ed-late ed-late--2">
          <HomePrompt />
          <ul className="ed-chips">
            {HERO_LINKS.map((l) => (
              <li key={l.label}><Link href={{ pathname: "/plan", query: { q: l.query } }}>{l.label}</Link></li>
            ))}
          </ul>
        </div>
      </div>
      <span className="ed-caption ed-mono" aria-hidden>Plate I · Midtown Manhattan, live</span>
    </section>
  );
}
```

Create `src/components/home/PlanDemo.tsx`:
```tsx
"use client";

export function PlanDemo() {
  return <section id="watch" className="ed-demo ed-paper" aria-label="Watch it plan" />;
}
```

Create `src/components/home/NeighborhoodStory.tsx`:
```tsx
"use client";

export function NeighborhoodStory() {
  return <section id="neighborhoods" className="ed-story ed-paper" aria-label="Neighborhoods" />;
}
```

- [ ] **Step 6: Rewrite the page**

Replace all of `src/app/page.tsx` with:
```tsx
import { preconnect } from "react-dom";
import "./home.css";
import { Colophon } from "@/components/home/Colophon";
import { edFonts } from "@/components/home/fonts";
import { HeroStage } from "@/components/home/HeroStage";
import { Journeys } from "@/components/home/Journeys";
import { NeighborhoodStory } from "@/components/home/NeighborhoodStory";
import { PlanDemo } from "@/components/home/PlanDemo";

// Runs while the HTML is parsed, before first paint: repeat visits in this session, reduced
// motion and lite devices start with the intro already finished (no flash of the cover).
const SKIP_INTRO = `try{var n=navigator,c=n.connection;if(sessionStorage.getItem('roam_intro')||matchMedia('(prefers-reduced-motion: reduce)').matches||(c&&c.saveData)||(n.deviceMemory&&n.deviceMemory<=2))document.documentElement.dataset.intro='skip'}catch(e){}`;

export default function Home() {
  preconnect("https://maps.googleapis.com");
  preconnect("https://maps.gstatic.com", { crossOrigin: "anonymous" });
  preconnect("https://tile.googleapis.com");
  return (
    <main className={`ed ${edFonts}`}>
      <script dangerouslySetInnerHTML={{ __html: SKIP_INTRO }} />
      <noscript>
        <style>{`.ed-late,.ed-solid i{opacity:1!important;transform:none!important}.ed-knock{display:none}`}</style>
      </noscript>
      <HeroStage />
      <PlanDemo />
      <NeighborhoodStory />
      <Journeys />
      <Colophon />
    </main>
  );
}
```

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev` (keep it running), open `http://localhost:3000/`.
Expected:
- The hero shows the header, the eyebrow, and a large italic "New York" in dark ink on cream paper, with no console errors.
- The deck (tagline, prompt, links) is invisible for now. That's expected until Task 5.
- Journeys and the colophon render below on paper.

Then check the prompt: in DevTools run `document.querySelectorAll('.ed-late').forEach(e=>e.style.opacity=1)`, type "the Met and pizza" and press Enter. Expected: the URL becomes `/plan?q=the%20Met%20and%20pizza` and the planner starts planning. Open `/plan` directly and confirm it looks unchanged.
Toggle dark mode: the paper turns charcoal and the "New York" letters read light.

- [ ] **Step 8: Lint and commit**

Run: `npx eslint src/app/page.tsx src/components/home && npx tsc --noEmit -p .`
Expected: clean.
```bash
git add src/app/page.tsx src/app/home.css src/components/home
git commit -m "feat(home): editorial page shell, prompt, journeys, colophon"
```

---

### Task 5: The hero intro (ink → city → dive → orbit)

**Files:**
- Modify: `src/components/home/HeroStage.tsx` (full replacement below)

**Interfaces:**
- Consumes: `HERO`, `HERO_LINKS` (Task 1); `DIVE_TIMING`, `diveFrame`, `measureDiveOrigin`, `DiveOrigin` (Task 2); `useCityMap`, `isLite`, `readEnv`, `useInView`, `usePageVisible`, `usePrefersReducedMotion` (Task 3); CSS classes `city`, `dive`, `revealed`, `zoomed`, `landed` on `.ed-hero` (Task 4).

- [ ] **Step 1: Replace `HeroStage.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { formatTicker } from "./camera";
import { isLite, readEnv } from "./cityMap";
import { HERO, HERO_LINKS } from "./data";
import { DIVE_TIMING, diveFrame, measureDiveOrigin, type DiveOrigin } from "./diveOrigin";
import { HomePrompt } from "./HomePrompt";
import { useCityMap } from "./useCityMap";
import { useInView, usePageVisible, usePrefersReducedMotion } from "./visibility";

const WORD = "New York";
const INTRO_KEY = "roam_intro";
const glyphs = (stagger: number) =>
  [...WORD].map((c, i) => (
    <i key={i} style={stagger ? { animationDelay: `${i * stagger}s` } : undefined}>{c === " " ? " " : c}</i>
  ));

/** Same rule as the inline script in page.tsx; also covers soft navigations, where that script doesn't run. */
function introSkipped(): boolean {
  const html = document.documentElement;
  if (html.dataset.intro === "skip") return true;
  let seen = false;
  try {
    seen = !!sessionStorage.getItem(INTRO_KEY);
  } catch {}
  const skip = seen || matchMedia("(prefers-reduced-motion: reduce)").matches || isLite(readEnv());
  if (skip) html.dataset.intro = "skip";
  return skip;
}

function centreOf(word: HTMLElement): DiveOrigin {
  const r = word.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, radius: r.height * 0.06 };
}

export function HeroStage() {
  const heroRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const knockRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const tickerRef = useRef<HTMLSpanElement>(null);

  // Decided during the first client render, before paint. Not rendered, so no hydration mismatch.
  const [skip] = useState(() => typeof document !== "undefined" && introSkipped());
  const [settled, setSettled] = useState(skip);
  const { map, failed } = useCityMap(hostRef, HERO.high, "hero");
  const onScreen = useInView(heroRef);
  const pageVisible = usePageVisible();
  const reduced = usePrefersReducedMotion();

  // No map at all (no WebGL): show the finished page.
  useEffect(() => {
    if (failed) document.documentElement.dataset.intro = "skip";
  }, [failed]);

  // The intro. All per-frame work goes straight to the DOM; React re-renders once, at the end.
  useEffect(() => {
    if (!map) return;
    if (skip) {
      map.jumpTo(HERO.landed);
      return;
    }
    const hero = heroRef.current!, knock = knockRef.current!, word = wordRef.current!;
    let raf = 0, cancelled = false;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    hero.classList.add("city"); // the city fades in inside the ink letters
    map.orbit(HERO.high, 240);

    document.fonts.ready.then(() => {
      if (cancelled) return;
      const origin = measureDiveOrigin(word) ?? centreOf(word);
      at(2300, () => {
        const k = knock.getBoundingClientRect();
        knock.style.transformOrigin = `${origin.x - k.left}px ${origin.y - k.top}px`;
        const cover = Math.hypot(innerWidth, innerHeight) / Math.max(origin.radius, 1);
        hero.classList.add("dive");
        void map.flyTo(HERO.landed, 3600).then(() => !cancelled && setSettled(true));

        const t0 = performance.now();
        const frame = (now: number) => {
          const f = diveFrame(now - t0, cover);
          knock.style.transform = `scale(${f.scale})`;
          knock.style.opacity = String(f.opacity);
          if (!f.done) raf = requestAnimationFrame(frame);
          else hero.classList.remove("dive");
        };
        raf = requestAnimationFrame(frame);

        const { pre, dive } = DIVE_TIMING;
        at(pre + dive * 0.7, () => hero.classList.add("revealed"));
        at(pre + dive + 250, () => hero.classList.add("zoomed"));
        at(pre + dive + 1000, () => {
          hero.classList.add("landed");
          try {
            sessionStorage.setItem(INTRO_KEY, "1");
          } catch {}
        });
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [map, skip]);

  // After landing: orbit the Empire State, but only while the hero is on screen and the tab is visible.
  useEffect(() => {
    if (!map || !settled || reduced) return;
    if (onScreen && pageVisible) map.orbit(HERO.landed, 200);
    else map.stop();
  }, [map, settled, onScreen, pageVisible, reduced]);

  // Coordinates ticker, at most 4 updates a second.
  useEffect(() => {
    if (!map) return;
    let last = 0;
    return map.onMove((lat, lng, heading) => {
      const now = performance.now();
      if (now - last < 250 || !tickerRef.current) return;
      last = now;
      tickerRef.current.textContent = formatTicker(lat, lng, heading);
    });
  }, [map]);

  function replay() {
    try {
      sessionStorage.removeItem(INTRO_KEY);
    } catch {}
    delete document.documentElement.dataset.intro;
    location.reload();
  }

  return (
    <section ref={heroRef} id="top" className="ed-hero" aria-labelledby="hero-title">
      <div ref={hostRef} className="ed-hero-map" />
      <div ref={knockRef} className="ed-knock" aria-hidden>
        <span ref={wordRef} className="ed-knock-word">{glyphs(0)}</span>
      </div>
      <div className="ed-scrim" aria-hidden />
      <header className="ed-header ed-chrome">
        <Link href="/" className="ed-wordmark ed-display">Roam</Link>
        <nav className="ed-mono" aria-label="Sections">
          <a href="#watch" className="ed-navlink">How it works</a>
          <a href="#neighborhoods" className="ed-navlink">Neighborhoods</a>
          <a href="#journeys" className="ed-navlink">Journeys</a>
          <ThemeToggle className="ed-theme" />
          <Link href="/plan" className="ed-btn">Open planner →</Link>
        </nav>
      </header>
      <div className="ed-eyebrow ed-gut ed-mono ed-chrome">
        <span className="ed-kicker">The day planner · Vol. I</span>
        <span>New York, N.Y. · Late city edition</span>
      </div>
      <span ref={tickerRef} className="ed-ticker ed-mono ed-chrome" aria-hidden>
        {formatTicker(HERO.high.lat, HERO.high.lng, HERO.high.heading)}
      </span>
      <div className="ed-deck ed-gut">
        <h1 id="hero-title" className="ed-hero-title" aria-label="New York. See it all. Skip the crowds.">
          <span className="ed-solid ed-display">{glyphs(0.06)}</span>
          <span className="ed-tagline ed-display ed-late">See it all. <i>Skip the crowds.</i></span>
        </h1>
        <div className="ed-late ed-late--2">
          <HomePrompt />
          <ul className="ed-chips">
            {HERO_LINKS.map((l) => (
              <li key={l.label}><Link href={{ pathname: "/plan", query: { q: l.query } }}>{l.label}</Link></li>
            ))}
          </ul>
        </div>
      </div>
      <span className="ed-caption ed-mono" aria-hidden>Plate I · Midtown Manhattan, live</span>
      <button type="button" className="ed-replay ed-mono" onClick={replay}>↻ Replay intro</button>
    </section>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/components/home/HeroStage.tsx && npx tsc --noEmit -p .`
Expected: clean. If `react-hooks` flags the `useState` initializer's side effect, keep it: it must run before paint, and it's not rendered.

- [ ] **Step 3: Watch the intro**

With `npm run dev` running, open a fresh tab (or clear session storage) at `http://localhost:3000/`, desktop width 1440×900.
Expected, in order:
1. Ink "New York" on paper.
2. The city fades in inside the letters.
3. About 2.3s later, the page dives into one letter and the map fills the screen before the paper fades. No paper slivers at the end.
4. The camera lands on the 3D Empire State Building.
5. "New York" re-sets letter by letter bottom-left, then the tagline, prompt and links rise in.
6. The ticker updates and the city slowly orbits.

- [ ] **Step 4: Measure the dive**

In the browser console, before reloading, run:
```js
window.__long = []; new PerformanceObserver(l => window.__long.push(...l.getEntries().map(e => Math.round(e.duration)))).observe({ type: "longtask", buffered: true });
```
Clear `sessionStorage`, reload, re-run that line straight away, wait 8s, then run `window.__long`.
Expected: no entry > 50 during the dive window (entries during the initial map load are acceptable; note them). If the dive stutters, check that only `transform`/`opacity` are changing (Performance panel: no Layout during the dive).

- [ ] **Step 5: Repeat visit and reduced motion**

Reload the same tab. Expected: no intro. The page paints directly in the landed state (map at the Empire State, deck visible) with no flash of paper.
In DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce", open a fresh tab. Expected: landed state and no orbit.

- [ ] **Step 6: Forced Google failure (Review Focus 1)**

Stop the dev server, run `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=invalid npm run dev`, and open a fresh tab.
Expected:
- The console shows `Google 3D map unavailable, using the satellite fallback.`
- The MapLibre satellite map appears inside the letters and the dive still completes.
- The deck appears.

Then run `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY= npm run dev`. Expected: MapLibre directly, with no Google requests in the Network panel. Restart normally afterwards.

- [ ] **Step 7: Soft navigation back (Review Focus 2)**

After the intro, click "Open planner →", then use the planner's own link or the browser back button to return to `/`.
Expected: no intro and no paper flash; the hero shows the landed map.

- [ ] **Step 8: Tab hidden mid-intro (Review Focus 3)**

Fresh tab. As soon as the letters fill with the city, switch to another tab for about 5s, then come back.
Expected: the page is in a coherent landed state (paper gone, deck visible). If the paper layer is stuck mid-scale, fix it: in the `landed` timer, also set `knock.style.opacity = "0"`.

- [ ] **Step 9: Dark theme intro (Review Focus 5)**

Toggle dark mode, clear session storage, reload.
Expected: light letters on charcoal before the map paints, then the city shows inside them and the dive works the same.

- [ ] **Step 10: Commit**

```bash
git add src/components/home/HeroStage.tsx
git commit -m "feat(home): ink-to-city intro with dive into 3D Manhattan"
```

---

### Task 6: "Watch it plan" demo

**Files:**
- Modify: `src/components/home/PlanDemo.tsx` (full replacement)

**Interfaces:**
- Consumes: `DEMO` (Task 1), `interpolate`, `routePath`, `LatLng` (Task 1), `useCityMap`, `useInView`, `usePageVisible`, `usePrefersReducedMotion` (Task 3), `.ed-demo*`, `.ed-row*`, `.ed-callout` classes (Task 4).

- [ ] **Step 1: Replace `PlanDemo.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { interpolate, routePath, type LatLng } from "./camera";
import { DEMO } from "./data";
import { useCityMap } from "./useCityMap";
import { useInView, usePageVisible, usePrefersReducedMotion } from "./visibility";

const label = (i: number) => `${i + 1} · ${DEMO.stops[i].name}`;

export function PlanDemo() {
  const sectionRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const typedRef = useRef<HTMLSpanElement>(null);
  const runRef = useRef<AbortController | null>(null);
  const started = useRef(false);

  const near = useInView(sectionRef, { rootMargin: "100% 0px", once: true });
  // A band in the middle of the screen, so a section taller than the viewport still triggers.
  const visible = useInView(sectionRef, { rootMargin: "-30% 0px -30% 0px" });
  const pageVisible = usePageVisible();
  const reduced = usePrefersReducedMotion();
  const { map } = useCityMap(hostRef, DEMO.overview, "secondary", near);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);

  const play = useCallback(async () => {
    if (!map || !typedRef.current) return;
    runRef.current?.abort();
    const run = new AbortController();
    runRef.current = run;
    const typed = typedRef.current;
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        run.signal.addEventListener("abort", () => (clearTimeout(t), reject(run.signal.reason)), { once: true });
      });

    map.clearOverlays();
    setShown(0);
    setDone(false);
    typed.textContent = "";
    if (reduced) {
      typed.textContent = DEMO.sentence;
      DEMO.stops.forEach((s, i) => map.addPin(s, label(i)));
      map.setRoute(routePath(DEMO.stops, 24));
      map.jumpTo(DEMO.route);
      setShown(DEMO.stops.length);
      setDone(true);
      return;
    }
    try {
      void map.flyTo(DEMO.overview, 800);
      for (let i = 1; i <= DEMO.sentence.length; i++) {
        typed.textContent = DEMO.sentence.slice(0, i);
        await wait(26);
      }
      await wait(300);
      void map.flyTo(DEMO.route, 1600);
      await wait(1200);
      const path: LatLng[] = [DEMO.stops[0]];
      for (let i = 0; i < DEMO.stops.length; i++) {
        map.addPin(DEMO.stops[i], label(i));
        setShown(i + 1);
        const next = DEMO.stops[i + 1];
        if (next) {
          for (const p of interpolate(DEMO.stops[i], next, 24)) {
            path.push(p);
            map.setRoute(path);
            await wait(28);
          }
        }
        await wait(250);
      }
      setDone(true);
    } catch {
      // replaced by a newer run, or unmounted
    }
  }, [map, reduced]);

  // Play once, the first time the section is in the middle of the screen with its map ready.
  useEffect(() => {
    if (map && visible && !started.current) {
      started.current = true;
      void play();
    }
  }, [map, visible, play]);

  useEffect(() => () => runRef.current?.abort(), []);

  // Idle when off screen.
  useEffect(() => {
    if (!map || !done || reduced) return;
    if (visible && pageVisible) map.orbit(DEMO.route, 90);
    else map.stop();
  }, [map, done, visible, pageVisible, reduced]);

  return (
    <section ref={sectionRef} id="watch" className="ed-demo ed-paper" aria-labelledby="watch-title">
      <div className="ed-demo-copy ed-gut">
        <span className="ed-mono ed-kicker">Watch it plan</span>
        <h2 id="watch-title" className="ed-h2">One sentence in.<br /><i>A whole day out.</i></h2>
        <div className="ed-prompt" aria-hidden>
          <span ref={typedRef} className="ed-typed" />
          <span className="ed-btn">Plan →</span>
        </div>
        <ol className="ed-itin" aria-label="Example itinerary">
          {DEMO.stops.map((s, i) => (
            <li key={s.name} className={`ed-row${i < shown ? " on" : ""}`}>
              <span className="ed-bullet">{i + 1}</span>
              <span className="ed-row-time">{s.time}</span>
              <div>
                <div className="ed-row-name">{s.name}</div>
                <div className="ed-row-why">{s.why}</div>
              </div>
              <div className="ed-crowd" role="img" aria-label={`Crowds by hour at ${s.name}; Roam picked a quiet one`}>
                {s.crowd.map((h, j) => <b key={j} className={j === s.slot ? "on" : undefined} style={{ height: h * 2 }} />)}
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="ed-btn ed-btn--ghost ed-demo-replay" onClick={() => void play()} disabled={!map}>
          ↻ Replay
        </button>
      </div>
      <div className="ed-demo-map">
        <div ref={hostRef} className="ed-map-host" />
        <div className={`ed-callout${done ? " on" : ""}`}>
          <span className="ed-mono ed-kicker">Roam&apos;s order</span>
          <strong>44 min less travel</strong>
          <em>and every stop at its quiet hour</em>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/components/home/PlanDemo.tsx && npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 3: Check the lazy loading**

Fresh tab at `http://localhost:3000/`, then open DevTools → Network, filtered to `maps`. Stay in the hero.
Expected: exactly one `gmp-map-3d` in the DOM (`document.querySelectorAll('gmp-map-3d').length === 1`).
Scroll until the demo is about 1 viewport away. Expected: the count becomes 2.

- [ ] **Step 4: Watch the demo**

Scroll the demo into the middle of the screen.
Expected: the prompt types itself, the map flies over Midtown, and pins 1–4 drop while the red route draws leg by leg and rows appear on the left. The "44 min less travel" callout then fades in and the map orbits slowly. "↻ Replay" runs it again from scratch without leftover pins. Scroll away and back: no restart; the orbit pauses off screen (`map` camera stops moving).

- [ ] **Step 5: Phone width (Review Focus 4)**

DevTools device toolbar at 375×812, fresh tab, scroll to the demo.
Expected: the copy is stacked above the map, and the demo still starts when the stacked section reaches mid-screen.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/PlanDemo.tsx
git commit -m "feat(home): self-playing plan demo on the 3D map"
```

---

### Task 7: Neighborhoods scrollytelling

**Files:**
- Modify: `src/components/home/NeighborhoodStory.tsx` (full replacement)

**Interfaces:**
- Consumes: `NEIGHBORHOODS` (Task 1), `useCityMap`, `useInView`, `usePageVisible`, `usePrefersReducedMotion` (Task 3), `.ed-story`, `.ed-chapter`, `.ed-sticky*` (Task 4).

- [ ] **Step 1: Replace `NeighborhoodStory.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NEIGHBORHOODS } from "./data";
import { useCityMap } from "./useCityMap";
import { useInView, usePageVisible, usePrefersReducedMotion } from "./visibility";

export function NeighborhoodStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const chaptersRef = useRef<HTMLDivElement>(null);

  const near = useInView(sectionRef, { rootMargin: "100% 0px", once: true });
  const inView = useInView(sectionRef);
  const pageVisible = usePageVisible();
  const reduced = usePrefersReducedMotion();
  const { map } = useCityMap(hostRef, NEIGHBORHOODS[0].camera, "secondary", near);
  const [active, setActive] = useState(0);

  // The chapter crossing the middle of the screen is the active one.
  useEffect(() => {
    const chapters = chaptersRef.current?.querySelectorAll<HTMLElement>("[data-index]");
    if (!chapters) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
    }, { rootMargin: "-45% 0px -45% 0px" });
    chapters.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  // Fly to the active chapter, then orbit it; idle when off screen.
  useEffect(() => {
    if (!map) return;
    if (!inView || !pageVisible) return map.stop();
    const cam = NEIGHBORHOODS[active].camera;
    if (reduced) return map.jumpTo(cam);
    let live = true;
    void map.flyTo(cam, 3200).then(() => live && map.orbit(cam, 70));
    return () => {
      live = false;
    };
  }, [map, active, inView, pageVisible, reduced]);

  const current = NEIGHBORHOODS[active];
  return (
    <section ref={sectionRef} id="neighborhoods" className="ed-story ed-paper" aria-label="Neighborhoods">
      <div ref={chaptersRef}>
        {NEIGHBORHOODS.map((n, i) => (
          <article key={n.name} data-index={i} className={`ed-chapter ed-gut${i === active ? " active" : ""}`}>
            <span className="ed-mono ed-kicker">{i === 0 ? `Neighborhoods · ${n.numeral}` : n.numeral}</span>
            <h3>{n.name} <i>{n.italic}</i></h3>
            <p>{n.body}</p>
            <Link href={{ pathname: "/plan", query: { q: n.query } }} className="ed-mono">Plan a day here →</Link>
          </article>
        ))}
      </div>
      <div className="ed-sticky">
        <div ref={hostRef} className="ed-map-host" />
        <span className="ed-sticky-label ed-mono" aria-live="polite">{current.name} {current.italic}</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/components/home/NeighborhoodStory.tsx && npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 3: Scroll the story (desktop)**

Expected: the map is pinned on the right. Each chapter reaching mid-screen turns fully opaque, the label updates, and the camera flies to the Washington Square arch, then the Natural History museum, DUMBO under the Manhattan Bridge, and Midtown/Empire State, orbiting slowly at each. `document.querySelectorAll('gmp-map-3d').length` is 3 only once you're near this section.

- [ ] **Step 4: Phone width (Review Focus 4)**

At 375×812: the map is pinned in the top half, the chapters scroll beneath it, and the flights still follow the chapters.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/NeighborhoodStory.tsx
git commit -m "feat(home): neighborhood scrollytelling on the 3D map"
```

---

### Task 8: Remove the old home page and update docs

**Files:**
- Delete: `src/components/plan/LandingPrompt.tsx`, `src/components/map/AmbientMap.tsx`, `src/components/map/LazyMaps.tsx`
- Modify: `src/app/globals.css` (home-only rules), `AGENTS.md` (Roam section only), `docs/UI-UX.md` (Landing Page section)

- [ ] **Step 1: Confirm nothing else imports the old files**

Run: `grep -rn "LandingPrompt\|PRESET_IDEAS\|AmbientMap\|LazyMaps" src`
Expected: no matches outside the three files themselves. If there are other matches, stop and report instead of deleting.

- [ ] **Step 2: Delete them**

```bash
git rm src/components/plan/LandingPrompt.tsx src/components/map/AmbientMap.tsx src/components/map/LazyMaps.tsx
```

- [ ] **Step 3: Remove home-only CSS**

Run: `grep -rn "neo-home\|neo-map-wash\|ambient-map-layer" src --include=*.tsx`
Expected: no matches. Then, in `src/app/globals.css`, delete every rule whose selector is only `.neo-home`, `.neo-map-wash`, `.dark .neo-map-wash`, `.ambient-map-layer` or `.dark .ambient-map-layer`, and remove `.neo-map-wash` from the grouped selector list near line 627. Keep every other `.neo-*` rule: the planner uses them (`ChoicePanel.tsx`, `Discover.tsx`, `ThemeToggle.tsx`).
Run: `grep -n "neo-home\|neo-map-wash\|ambient-map-layer" src/app/globals.css`
Expected: no matches.

- [ ] **Step 4: Update the docs**

In `AGENTS.md`, replace only the bullet that begins `- **Home Page Ambient Map**` with:
```markdown
- **Home Page Map**: The home page uses Google's photorealistic 3D Maps (`src/components/home/cityMapGoogle.ts`, Maps JS channel `beta`) behind an editorial layout, with the MapLibre satellite view as the automatic fallback (`cityMapLibre.ts`). The intro (ink letters → city → dive → orbit) runs once per session. No map switcher on the home page.
```
In `docs/UI-UX.md`, replace the whole `### Landing Page (\`/\`)` section (up to the `---` before `### Planner Page`) with:
```markdown
### Landing Page (`/`)

**Goal:** Communicate the product in under 10 seconds and get people into the planner.

**Design:** Editorial New York: cream paper and ink (charcoal "evening edition" in dark mode), Instrument Serif headlines, Newsreader text, IBM Plex Mono labels, one red accent, numbered route bullets. Styles live in `src/app/home.css`, scoped under `.ed`.

**Sections:**
1. **Hero:** "New York" is printed in ink; Google's photorealistic 3D Manhattan fades in inside the letters, the page dives through a letter, and the camera lands orbiting the Empire State Building. The deck holds the prompt (submits to `/plan?q=…`) and three journey links. Plays once per session; reduced motion and lite devices start landed.
2. **Watch it plan:** a self-typing prompt builds an example itinerary while the route draws on a 3D map.
3. **Neighborhoods:** scrollytelling; a pinned 3D map flies to each neighborhood.
4. **Journeys:** a contents list of four ready-made days.
5. **Colophon:** data sources.

**Performance:** copy is server-rendered; each map is created only near the viewport and idles off screen; Google failures fall back to MapLibre.
```

- [ ] **Step 5: Verify and commit**

Run: `npm run lint && npm test && npm run build`
Expected: all pass. Then open `/plan` in the dev server and confirm the planner looks and works as before (chips, discover search, theme toggle).
```bash
git add -A src/app/globals.css AGENTS.md docs/UI-UX.md
git commit -m "chore(home): remove old landing page and update docs"
```

---

### Task 9: Performance pass

**Files:**
- Modify: only if a check below fails (the fixes are listed under each check).

- [ ] **Step 1: Production build**

Run: `npm run build && npm run start` (port 3000).
Expected: the build output lists `/` as static (○).

- [ ] **Step 2: Lighthouse (desktop)**

Run:
```bash
npx lighthouse http://localhost:3000/ --preset=desktop --only-categories=performance --quiet --chrome-flags="--headless=new" --output=json --output-path=./.superpowers/lh-home.json
node -e "const r=require('./.superpowers/lh-home.json');console.log('score',r.categories.performance.score*100,'LCP',r.audits['largest-contentful-paint'].displayValue,'TBT',r.audits['total-blocking-time'].displayValue,'CLS',r.audits['cumulative-layout-shift'].displayValue)"
```
Expected: score ≥ 90, CLS < 0.05, LCP element = the "New York" knockout text.
If it's below 90:
- TBT high → confirm `maplibre-gl` isn't in the initial chunk (`.next/static/chunks`: it should load only on fallback).
- LCP late → confirm `.ed-knock-word` is visible at first paint.
- Unused fonts → the root layout's four families preload on `/` too. Report it rather than moving them, because the planner needs them.

- [ ] **Step 3: One map for a hero-only visit**

Fresh tab on the production server; don't scroll. After 10s run `document.querySelectorAll('gmp-map-3d').length`.
Expected: `1`.

- [ ] **Step 4: Idle off screen**

Scroll to the Journeys section and record 3s in the DevTools Performance panel.
Expected: no continuous `requestAnimationFrame` activity from the maps; GPU frames drop to near zero.

- [ ] **Step 5: Final checks and commit fixes (if any)**

Run: `npm run lint && npm test`
Expected: pass.
If a check needed a fix, commit it with a message that names the fix, for example:
```bash
git add -A src
git commit -m "perf(home): keep maplibre out of the initial chunk"
```
Skip the commit if nothing changed.
