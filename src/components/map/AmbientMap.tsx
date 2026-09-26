"use client";

import { useEffect, useRef } from "react";
import { AttributionControl, Map as MapLibre } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SATELLITE_3D_STYLE, ensureWorker, prefersReducedMotion, resolveMissingStyleImages } from "./mapStyle";

/**
 * The home page backdrop: photorealistic 3D satellite view of Manhattan with real OSM
 * extruded buildings and terrain DEM, slowly and majestically rotating in the background.
 * The home page map is permanently locked to this 3D satellite view.
 */
export function AmbientMap({ className }: { className?: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    ensureWorker();

    const map = new MapLibre({
      container: container.current,
      style: SATELLITE_3D_STYLE,
      center: [-73.985, 40.738],
      zoom: 13.6,
      pitch: 60,
      bearing: -28,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });

    resolveMissingStyleImages(map);
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    let frame = 0;
    if (!prefersReducedMotion()) {
      let last = performance.now();
      // Rotate slowly: a calm, cinematic orbital drift (~0.00055 deg/ms)
      const drift = (now: number) => {
        const dt = Math.min(64, now - last);
        last = now;
        map.setBearing(map.getBearing() + dt * 0.00055);
        frame = requestAnimationFrame(drift);
      };
      map.once("idle", () => {
        frame = requestAnimationFrame(drift);
      });
    }

    return () => {
      cancelAnimationFrame(frame);
      map.remove();
    };
  }, []);

  return <div ref={container} aria-hidden className={className} />;
}
