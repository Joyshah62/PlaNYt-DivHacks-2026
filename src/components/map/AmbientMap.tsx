"use client";

import { useEffect, useRef } from "react";
import { AttributionControl, Map as MapLibre } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { STYLES, ensureWorker, prefersReducedMotion, resolveColors, useDarkScheme } from "./mapStyle";

/**
 * The landing page backdrop: the city in 3D, drifting slowly. Decorative, so it
 * takes no input and stays still for anyone who prefers reduced motion.
 */
export function AmbientMap({ className }: { className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const dark = useDarkScheme();

  useEffect(() => {
    if (!container.current) return;
    ensureWorker();
    const map = new MapLibre({
      container: container.current,
      style: dark ? STYLES.dark : STYLES.light,
      center: [-73.992, 40.728],
      zoom: 13.4,
      pitch: 58,
      bearing: -28,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    map.on("style.load", () => {
      const c = resolveColors();
      const firstSymbol = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
      if (map.getLayer("background")) map.setPaintProperty("background", "background-color", c["--background"]);
      if (map.getSource("openmaptiles")) {
        map.addLayer(
          {
            id: "ambient-buildings",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 12,
            paint: {
              "fill-extrusion-color": dark ? "rgb(50,48,46)" : "rgb(230,225,215)",
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.92,
            },
          },
          firstSymbol,
        );
      }
    });

    let frame = 0;
    if (!prefersReducedMotion()) {
      let last = performance.now();
      const drift = (now: number) => {
        const dt = Math.min(64, now - last);
        last = now;
        map.setBearing(map.getBearing() + dt * 0.0022);
        frame = requestAnimationFrame(drift);
      };
      map.once("idle", () => (frame = requestAnimationFrame(drift)));
    }

    return () => {
      cancelAnimationFrame(frame);
      map.remove();
    };
  }, [dark]);

  return <div ref={container} aria-hidden className={className} />;
}
