"use client";

import { useSyncExternalStore } from "react";
import { setWorkerUrl } from "maplibre-gl";
import type { LatLon } from "@/lib/osm/types";

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

const COLOR_VARS = ["--brand", "--background", "--foreground", "--muted-foreground", "--card", ...CATEGORY_IDS.map((c) => `--cat-${c}`)];

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

/** Straight-line fallback for walking zones, matching the walk estimate model. */
export function circleZones(center: LatLon): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [15, 10, 5].map((min) => {
      const meters = (min * 80) / 1.3;
      const dLat = meters / 111_320;
      const dLon = meters / (111_320 * Math.cos((center.lat * Math.PI) / 180));
      const ring: [number, number][] = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * 2 * Math.PI;
        ring.push([center.lon + dLon * Math.cos(a), center.lat + dLat * Math.sin(a)]);
      }
      return { type: "Feature" as const, properties: { min }, geometry: { type: "Polygon" as const, coordinates: [ring] } };
    }),
  };
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
