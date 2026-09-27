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
  /** NEXT_PUBLIC_MAP_ENGINE: "maplibre" (free, local development) or "google" (demos, hosting). */
  forced?: Engine;
}

export type Engine = "google" | "maplibre";

/** Reads NEXT_PUBLIC_MAP_ENGINE; anything other than maplibre/google means "automatic". */
export function parseEngine(value: string | undefined): Engine | undefined {
  const v = value?.trim().toLowerCase();
  return v === "maplibre" || v === "google" ? v : undefined;
}

export const isLite = (env: EngineEnv) => env.saveData || (env.deviceMemory !== undefined && env.deviceMemory <= 2);

export function chooseEngine(env: EngineEnv, role: MapRole): "google" | "maplibre" | "none" {
  if (!env.webgl) return "none";
  if (env.forced === "maplibre" || !env.hasKey) return "maplibre";
  if (env.forced === "google") return "google";
  if (role === "secondary" && isLite(env)) return "maplibre";
  return "google";
}

type VisibilityDoc = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

/**
 * Like setTimeout, but the clock only starts once the page is visible. A hidden tab doesn't
 * render maps, so "no answer yet" there means "not tried yet", not "slow". Returns a cancel.
 */
export function visibleTimeout(doc: VisibilityDoc, ms: number, fn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const start = () => {
    if (doc.visibilityState !== "visible" || timer !== undefined) return;
    doc.removeEventListener("visibilitychange", start);
    timer = setTimeout(fn, ms);
  };
  doc.addEventListener("visibilitychange", start);
  start();
  return () => {
    doc.removeEventListener("visibilitychange", start);
    clearTimeout(timer);
  };
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
    forced: parseEngine(process.env.NEXT_PUBLIC_MAP_ENGINE),
  };
}

// Once Google has failed on this page, later maps go straight to the fallback.
let googleBroken = false;

/**
 * Build a map in `host` and resolve once it has painted. Engines load on demand. Aborting
 * `signal` (the caller unmounted) removes a half-built map at once and resolves null.
 */
export async function createCityMap(host: HTMLElement, cam: Camera, role: MapRole, signal?: AbortSignal): Promise<CityMap | null> {
  const engine = chooseEngine(readEnv(), role);
  if (engine === "none") return null;
  if (engine === "google" && !googleBroken) {
    try {
      const { createGoogleMap } = await import("./cityMapGoogle");
      if (signal?.aborted) return null;
      return await createGoogleMap(host, cam, signal);
    } catch (err) {
      if (signal?.aborted) return null;
      console.warn("Google 3D map unavailable, using the satellite fallback.", err);
      googleBroken = true;
    }
  }
  const { createLibreMap } = await import("./cityMapLibre");
  if (signal?.aborted) return null;
  return createLibreMap(host, cam, signal).catch((err) => {
    if (signal?.aborted) return null;
    throw err;
  });
}
