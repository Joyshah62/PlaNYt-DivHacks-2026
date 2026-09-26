"use client";

import { Map as MapLibre, Marker, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ensureWorker } from "@/components/map/mapStyle";
import { rangeToZoom, type Camera, type LatLng } from "./camera";
import { visibleTimeout, type CityMap } from "./cityMap";

// Above ~50° the flat satellite raster runs out of tiles and shows a jagged black horizon.
const MAX_PITCH = 50;

// Flat satellite imagery (no terrain requests; Manhattan is flat) over a dusk-coloured base, so
// tiles that haven't arrived read as shadow rather than black.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Tiles © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    { id: "base", type: "background", paint: { "background-color": "#2a2823" } },
    { id: "satellite", type: "raster", source: "satellite" },
  ],
};

const view = (c: Camera) => ({
  center: [c.lng, c.lat] as [number, number],
  zoom: rangeToZoom(c.range),
  // Zoomed out, the horizon comes into view sooner: tilt less over wide views.
  pitch: Math.min(c.tilt, rangeToZoom(c.range) < 13 ? 40 : MAX_PITCH),
  bearing: c.heading,
});

const ROUTE = "roam-route";

export async function createLibreMap(host: HTMLElement, cam: Camera, signal?: AbortSignal): Promise<CityMap> {
  signal?.throwIfAborted();
  ensureWorker();
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;inset:0";
  host.append(el);
  const map = new MapLibre({
    container: el, style: STYLE, ...view(cam), maxPitch: MAX_PITCH,
    interactive: false, attributionControl: { compact: true }, fadeDuration: 0,
  });
  await new Promise<void>((resolve, reject) => {
    const done = () => {
      cancelTimer();
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      cancelTimer();
      map.remove();
      el.remove();
      reject(signal?.reason);
    };
    const cancelTimer = visibleTimeout(document, 8000, done);
    map.once("idle", done);
    signal?.addEventListener("abort", abort, { once: true });
  });

  // The compact credit opens itself once the tiles' attribution arrives and only collapses after
  // a drag, which these maps never get: collapse it to its (i) button. The credit stays one
  // click away (Esri requires it).
  const credit = el.querySelector(".maplibregl-ctrl-attrib");
  credit?.classList.remove("maplibregl-compact-show");
  credit?.removeAttribute("open");

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
