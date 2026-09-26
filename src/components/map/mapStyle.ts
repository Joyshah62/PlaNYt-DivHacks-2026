"use client";

import { useSyncExternalStore } from "react";
import { setWorkerUrl, type Map as MapLibre } from "maplibre-gl";

let workerSet = false;

/** Served from /public by scripts/copy-maplibre-worker.mjs; see there for why. Call before creating a map. */
export function ensureWorker() {
  if (workerSet) return;
  workerSet = true;
  setWorkerUrl(new URL("/maplibre/maplibre-gl-worker.mjs", window.location.origin).href);
}

export const STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

/** OpenFreeMap's current style references this optional tile texture without shipping it in its sprite. */
export function resolveMissingStyleImages(map: MapLibre) {
  map.setMissingStyleImageResolver((id) => {
    if (id !== "wood-pattern" || map.hasImage(id)) return;
    const [r = 120, g = 150, b = 120] = resolveColors()["--cat-parks"].match(/\d+/g)?.map(Number) ?? [];
    const data = new Uint8ClampedArray([
      r, g, b, 22, r, g, b, 12,
      r, g, b, 12, r, g, b, 22,
    ]);
    map.addImage(id, new ImageData(data, 2, 2));
  });
}

function subscribeScheme(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useDarkScheme(): boolean {
  return useSyncExternalStore(
    subscribeScheme,
    () => {
      const cl = document.documentElement.classList;
      return cl.contains("dark") || (!cl.contains("light") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    },
    () => false,
  );
}

export const CATEGORY_IDS = [
  "groceries", "restaurants", "coffee", "subway", "parks", "fitness", "pharmacy",
  "nightlife", "convenience", "laundry", "entertainment", "health", "bus",
] as const;

const COLOR_VARS = ["--brand", "--background", "--foreground", "--muted", "--muted-foreground", "--card", ...CATEGORY_IDS.map((c) => `--cat-${c}`)];

/** MapLibre cannot read CSS variables or oklch(); resolve them to rgb via a canvas pixel. */
export function resolveColors(): Record<string, string> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    COLOR_VARS.map((name) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = style.getPropertyValue(name).trim() || "#888";
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [name, `rgb(${r},${g},${b})`];
    }),
  );
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
