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

export type MapTheme = "day" | "night" | "satellite" | "transit";

export const SATELLITE_STYLE = {
  version: 8 as const,
  sources: {
    "esri-satellite": {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "satellite-layer",
      type: "raster" as const,
      source: "esri-satellite",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

export const SATELLITE_3D_STYLE = {
  version: 8 as const,
  sources: {
    "esri-satellite": {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
    terrain: {
      type: "raster-dem" as const,
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium" as const,
      tileSize: 256,
      maxzoom: 15,
    },
  },
  terrain: {
    source: "terrain",
    exaggeration: 1.4,
  },
  layers: [
    {
      id: "satellite-layer",
      type: "raster" as const,
      source: "esri-satellite",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

export const TRANSIT_STYLE = {
  version: 8 as const,
  sources: {
    "transit-tiles": {
      type: "raster" as const,
      tiles: [
        "https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
        "https://b.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
        "https://c.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "Tiles © CyclOSM, © OpenStreetMap contributors",
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: "transit-layer",
      type: "raster" as const,
      source: "transit-tiles",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

export const STYLES: Record<string, string | typeof SATELLITE_STYLE | typeof SATELLITE_3D_STYLE | typeof TRANSIT_STYLE> = {
  day: "https://tiles.openfreemap.org/styles/liberty",
  night: "https://tiles.openfreemap.org/styles/dark",
  satellite: SATELLITE_3D_STYLE,
  transit: TRANSIT_STYLE,
  // Backward-compatible aliases
  streets: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/liberty",
};

const mapThemeListeners = new Set<() => void>();

export function setMapTheme(theme: MapTheme) {
  if (typeof window !== "undefined") {
    localStorage.setItem("roam_map_theme", theme);
    window.dispatchEvent(new CustomEvent("roam_map_theme_changed", { detail: theme }));
  }
  for (const listener of mapThemeListeners) {
    listener();
  }
}

export function getMapTheme(): MapTheme {
  if (typeof window === "undefined") return "day";
  const stored = localStorage.getItem("roam_map_theme");
  if (stored === "day" || stored === "night" || stored === "satellite" || stored === "transit") {
    return stored;
  }
  if (stored === "streets" || stored === "light") return "day";
  if (stored === "dark") return "night";
  return "day";
}

export function useMapTheme(): [MapTheme, (theme: MapTheme) => void] {
  const theme = useSyncExternalStore(
    (callback) => {
      mapThemeListeners.add(callback);
      const onStorage = (e: StorageEvent) => {
        if (e.key === "roam_map_theme") callback();
      };
      const onCustom = () => callback();
      window.addEventListener("storage", onStorage);
      window.addEventListener("roam_map_theme_changed", onCustom);
      return () => {
        mapThemeListeners.delete(callback);
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("roam_map_theme_changed", onCustom);
      };
    },
    getMapTheme,
    () => "streets" as MapTheme,
  );
  return [theme, setMapTheme];
}

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
