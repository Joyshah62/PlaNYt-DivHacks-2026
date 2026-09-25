"use client";

import { useEffect, useRef } from "react";
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibre,
  Marker,
  Popup,
  type GeoJSONSource,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLon, Place } from "@/lib/osm/types";
import { STYLES, circleZones, ensureWorker, prefersReducedMotion, resolveColors, useDarkScheme } from "./mapStyle";
import type { MapDestination, MapFrame, MapHighlight, MapPick } from "./mapTypes";

export type { MapDestination, MapFrame, MapHighlight, MapPick } from "./mapTypes";

export interface CityMapProps {
  center: LatLon;
  places: Place[];
  highlight: MapHighlight;
  selectedId?: string | null;
  hoveredId?: string | null;
  zones?: GeoJSON.FeatureCollection | null;
  showZones?: boolean;
  buildings3d?: boolean;
  heatmap?: boolean;
  route?: { coordinates: [number, number][]; mode: "foot" | "car" } | null;
  destinations?: MapDestination[];
  selectedDestinationId?: string | null;
  frame: MapFrame;
  /** Room taken by floating UI, so fitted content is never hidden under it. */
  padding?: { top: number; right: number; bottom: number; left: number };
  onPick?: (pick: MapPick) => void;
  className?: string;
}

// ---------------------------------------------------------------------------

function isHit(p: Place, h: MapHighlight): boolean {
  if (h.ids) return h.ids.includes(p.id);
  if (!h.categories) return false;
  return h.categories.includes(p.category) && (!h.cuisine || p.cuisine === h.cuisine);
}

function placesData(places: Place[], h: MapHighlight, colors: Record<string, string>): GeoJSON.FeatureCollection {
  const active = h.ids !== null || h.categories !== null;
  const showBus = h.categories?.includes("bus") ?? false;
  return {
    type: "FeatureCollection",
    features: places
      // Bus stops would carpet the map; they appear only when asked for.
      .filter((p) => p.category !== "bus" || showBus || h.ids?.includes(p.id))
      .map((p) => {
        const hit = isHit(p, h);
        return {
          type: "Feature" as const,
          properties: {
            id: p.id,
            name: p.name,
            walk: `${p.estimated ? "~" : ""}${p.walkMin} min walk`,
            color: colors[`--cat-${p.category}`],
            hl: hit,
            dim: active && !hit,
            order: hit ? 2 : active ? 0 : 1,
          },
          geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
        };
      }),
  };
}

function destinationsData(list: MapDestination[], selected: string | null | undefined): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: list.map((d) => ({
      type: "Feature" as const,
      properties: { id: d.id, label: d.label, custom: d.custom, selected: d.id === selected },
      geometry: { type: "Point" as const, coordinates: [d.lon, d.lat] },
    })),
  };
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const FONT_REGULAR = ["Noto Sans Regular"];
const FONT_BOLD = ["Noto Sans Bold"];

// ---------------------------------------------------------------------------

/**
 * The neighborhood map. React owns the data; this component owns MapLibre and
 * pushes each prop into its layer imperatively, so a hover never re-renders
 * two thousand pins and a data change never resets the camera.
 */
export function CityMap(props: CityMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const readyRef = useRef(false);
  const colorsRef = useRef<Record<string, string>>({});
  const latest = useRef(props);
  const styleRef = useRef<string | null>(null);
  const featureState = useRef<{ selected: string | null; hovered: string | null }>({ selected: null, hovered: null });
  const lastFrame = useRef<string | null>(null);
  const dark = useDarkScheme();

  useEffect(() => {
    latest.current = props;
  });

  // --- appliers: each pushes one slice of props into the map ----------------

  function applyPlaces(map: MapLibre) {
    const { places, highlight } = latest.current;
    (map.getSource("places") as GeoJSONSource | undefined)?.setData(placesData(places, highlight, colorsRef.current));
  }

  function applyFeatureState(map: MapLibre) {
    if (!map.getSource("places")) return;
    const { selectedId = null, hoveredId = null } = latest.current;
    const prev = featureState.current;
    for (const id of new Set([prev.selected, prev.hovered, selectedId, hoveredId])) {
      if (!id) continue;
      map.setFeatureState({ source: "places", id }, { selected: id === selectedId, hovered: id === hoveredId });
    }
    featureState.current = { selected: selectedId, hovered: hoveredId };
  }

  function applyZones(map: MapLibre) {
    const { zones, center, showZones = true } = latest.current;
    (map.getSource("zones") as GeoJSONSource | undefined)?.setData(zones ?? circleZones(center));
    const v = showZones ? "visible" : "none";
    for (const id of ["zones-fill", "zones-line", "zones-label"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    if (map.getLayer("zones-line")) map.setPaintProperty("zones-line", "line-dasharray", zones ? [1, 0] : [2, 2]);
  }

  function applyLayers(map: MapLibre, animate: boolean) {
    const { buildings3d = false, heatmap = false } = latest.current;
    if (map.getLayer("rc-buildings")) map.setLayoutProperty("rc-buildings", "visibility", buildings3d ? "visible" : "none");
    if (map.getLayer("places-heat")) map.setLayoutProperty("places-heat", "visibility", heatmap ? "visible" : "none");
    if (animate) {
      map.easeTo({ pitch: buildings3d ? 55 : 0, bearing: buildings3d ? -18 : 0, duration: prefersReducedMotion() ? 0 : 900 });
    }
  }

  function applyRoute(map: MapLibre) {
    const { route } = latest.current;
    const source = map.getSource("route") as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(
      route
        ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.coordinates } }] }
        : EMPTY,
    );
    if (route) {
      map.setPaintProperty("route-line", "line-dasharray", route.mode === "foot" ? [0.1, 1.9] : [1, 0]);
      map.setPaintProperty("route-line", "line-width", route.mode === "foot" ? 5 : 4.5);
    }
  }

  function applyDestinations(map: MapLibre) {
    const { destinations = [], selectedDestinationId } = latest.current;
    (map.getSource("destinations") as GeoJSONSource | undefined)?.setData(destinationsData(destinations, selectedDestinationId));
  }

  function applyFrame(map: MapLibre, force = false) {
    const { frame, padding = { top: 72, right: 72, bottom: 72, left: 72 }, center } = latest.current;
    if (!force && frame.key === lastFrame.current) return;
    lastFrame.current = frame.key;
    const duration = prefersReducedMotion() ? 0 : 900;
    const points = frame.points.length ? frame.points : [[center.lon, center.lat] as [number, number]];
    if (points.length === 1) {
      map.easeTo({ center: points[0], zoom: frame.maxZoom ?? 15, padding, duration });
      return;
    }
    const bounds = new LngLatBounds(points[0], points[0]);
    for (const p of points) bounds.extend(p);
    map.fitBounds(bounds, { padding, maxZoom: frame.maxZoom ?? 16.5, duration });
  }

  // --- create the map once per center ---------------------------------------

  useEffect(() => {
    if (!container.current) return;
    ensureWorker();
    const { center } = latest.current;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    styleRef.current = dark ? STYLES.dark : STYLES.light;
    const map = new MapLibre({
      container: container.current,
      style: styleRef.current,
      center: [center.lon, center.lat],
      zoom: 14.6,
      minZoom: 9.5,
      maxZoom: 18.5,
      attributionControl: false,
      cooperativeGestures: coarse,
      maxPitch: 70,
    });
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;

    const el = document.createElement("div");
    el.className = "home-marker";
    el.setAttribute("aria-label", "This apartment");
    el.innerHTML = `<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V21H3z"/></svg></span>`;
    const home = new Marker({ element: el }).setLngLat([center.lon, center.lat]).addTo(map);

    const tooltip = new Popup({ closeButton: false, closeOnClick: false, offset: 14, className: "rc-tooltip" });

    const install = () => {
      readyRef.current = false;
      colorsRef.current = resolveColors();
      const c = colorsRef.current;
      const isDark = styleRef.current === STYLES.dark;
      const firstSymbol = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;

      // Match the basemap's ground to the page so the map feels part of it.
      if (map.getLayer("background")) map.setPaintProperty("background", "background-color", c["--background"]);

      if (map.getSource("openmaptiles")) {
        map.addLayer(
          {
            id: "rc-buildings",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 13,
            layout: { visibility: "none" },
            paint: {
              "fill-extrusion-color": isDark ? "rgb(52,50,48)" : "rgb(228,223,213)",
              "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["coalesce", ["get", "render_height"], 10]],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.88,
            },
          },
          firstSymbol,
        );
      }

      map.addSource("zones", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "zones-fill",
        type: "fill",
        source: "zones",
        paint: {
          "fill-color": c["--brand"],
          "fill-opacity": ["match", ["get", "min"], 5, 0.13, 10, 0.08, 0.05],
        },
      });
      map.addLayer({
        id: "zones-line",
        type: "line",
        source: "zones",
        paint: { "line-color": c["--brand"], "line-width": 1.4, "line-opacity": 0.65 },
      });
      map.addLayer({
        id: "zones-label",
        type: "symbol",
        source: "zones",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 380,
          "text-field": ["concat", ["to-string", ["get", "min"]], " min walk"],
          "text-font": FONT_BOLD,
          "text-size": 11,
          "text-letter-spacing": 0.04,
        },
        paint: { "text-color": c["--brand"], "text-halo-color": c["--background"], "text-halo-width": 2 },
      });

      map.addSource("places", { type: "geojson", data: EMPTY, promoteId: "id" });
      map.addLayer({
        id: "places-heat",
        type: "heatmap",
        source: "places",
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 12, 0.7, 16, 1.6],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 12, 12, 16, 42],
          "heatmap-opacity": 0.72,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.15, "rgba(80,120,255,0.35)",
            0.4, "rgba(120,90,255,0.6)",
            0.65, "rgba(255,140,60,0.8)",
            1, "rgba(235,60,70,0.95)",
          ],
        },
      });

      map.addSource("route", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c["--background"], "line-width": 10, "line-opacity": 0.92 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c["--brand"], "line-width": 5 },
      });

      map.addLayer({
        id: "places",
        type: "circle",
        source: "places",
        layout: { "circle-sort-key": ["get", "order"] },
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, ["case", ["get", "hl"], 4.5, 2.5], 16, ["case", ["get", "hl"], 9, 6]],
          "circle-opacity": ["case", ["get", "dim"], 0.2, 1],
          "circle-stroke-color": c["--card"],
          "circle-stroke-width": ["case", ["get", "hl"], 2.5, 1.25],
          "circle-stroke-opacity": ["case", ["get", "dim"], 0.25, 1],
        },
      });
      map.addLayer({
        id: "places-ring",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 15, 12],
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": c["--foreground"],
          "circle-stroke-width": 2.5,
          "circle-stroke-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 1,
            ["boolean", ["feature-state", "hovered"], false], 0.55,
            0,
          ],
        },
      });
      map.addLayer({
        id: "places-label",
        type: "symbol",
        source: "places",
        minzoom: 14.5,
        filter: ["==", ["get", "hl"], true],
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT_REGULAR,
          "text-size": 11.5,
          "text-anchor": "top",
          "text-offset": [0, 0.9],
          "text-max-width": 9,
          "text-optional": true,
        },
        paint: { "text-color": c["--foreground"], "text-halo-color": c["--card"], "text-halo-width": 1.8 },
      });

      map.addSource("destinations", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "destinations",
        type: "circle",
        source: "destinations",
        paint: {
          "circle-color": ["case", ["get", "custom"], c["--brand"], c["--foreground"]],
          "circle-radius": ["case", ["get", "selected"], 9, 6.5],
          "circle-stroke-color": c["--card"],
          "circle-stroke-width": 2.5,
        },
      });
      map.addLayer({
        id: "destinations-label",
        type: "symbol",
        source: "destinations",
        layout: {
          "text-field": ["get", "label"],
          "text-font": FONT_BOLD,
          "text-size": 12,
          "text-anchor": "left",
          "text-offset": [0.9, 0],
          "text-optional": true,
        },
        paint: { "text-color": c["--foreground"], "text-halo-color": c["--card"], "text-halo-width": 2 },
      });

      readyRef.current = true;
      featureState.current = { selected: null, hovered: null };
      applyPlaces(map);
      applyZones(map);
      applyLayers(map, false);
      applyRoute(map);
      applyDestinations(map);
      applyFeatureState(map);
      if (latest.current.buildings3d) map.jumpTo({ pitch: 55, bearing: -18 });
      applyFrame(map, lastFrame.current === null);
    };

    const pickAt = (features: MapGeoJSONFeature[]): MapPick => {
      const f = features[0];
      if (!f) return null;
      const id = String(f.properties.id);
      return { kind: f.layer.id.startsWith("destinations") ? "destination" : "place", id };
    };

    map.on("style.load", install);
    map.on("mousemove", "places", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const root = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = String(f.properties.name); // user-contributed text: never innerHTML
      const walk = document.createElement("span");
      walk.textContent = String(f.properties.walk);
      root.append(name, walk);
      tooltip.setLngLat(f.geometry.coordinates as [number, number]).setDOMContent(root).addTo(map);
    });
    map.on("mouseleave", "places", () => {
      map.getCanvas().style.cursor = "";
      tooltip.remove();
    });
    map.on("mouseenter", "destinations", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "destinations", () => (map.getCanvas().style.cursor = ""));
    map.on("click", (e) => {
      if (!readyRef.current) return;
      const features = map.queryRenderedFeatures(e.point, { layers: ["destinations", "places"] });
      tooltip.remove();
      latest.current.onPick?.(pickAt(features));
    });

    // The container resizes with the layout (panel widening, mobile rotation).
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);

    return () => {
      observer.disconnect();
      readyRef.current = false;
      home.remove();
      map.remove();
      mapRef.current = null;
      lastFrame.current = null;
    };
    // Everything else is pushed by the effects below; recreating would lose the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.center.lat, props.center.lon]);

  // --- push prop changes ----------------------------------------------------

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const want = dark ? STYLES.dark : STYLES.light;
    if (styleRef.current === want) return;
    styleRef.current = want;
    readyRef.current = false;
    // A full reload fires `style.load`, which re-installs our layers with fresh colors.
    map.setStyle(want, { diff: false });
  }, [dark]);

  const run = (fn: (map: MapLibre) => void) => {
    const map = mapRef.current;
    if (map && readyRef.current) fn(map);
  };

  // Each applier reads the latest props from a ref; the deps say when to push.
  useEffect(() => run(applyPlaces), [props.places, props.highlight]);
  useEffect(() => run(applyFeatureState), [props.selectedId, props.hoveredId, props.places]);
  useEffect(() => run(applyZones), [props.zones, props.showZones]);
  useEffect(() => run((m) => applyLayers(m, true)), [props.buildings3d, props.heatmap]);
  useEffect(() => run(applyRoute), [props.route]);
  useEffect(() => run(applyDestinations), [props.destinations, props.selectedDestinationId]);
  useEffect(() => run((m) => applyFrame(m)), [props.frame.key]);

  return <div ref={container} className={props.className} role="region" aria-label="Map of the area around this apartment" />;
}
