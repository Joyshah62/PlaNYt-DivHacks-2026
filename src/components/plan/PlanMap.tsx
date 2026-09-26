"use client";

import { useEffect, useRef, useState } from "react";
import { AttributionControl, LngLatBounds, Map as MapLibre, Marker, NavigationControl, Popup, type GeoJSONSource } from "maplibre-gl";
import { Box, Crosshair, Flame, Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapThemeSwitcher } from "@/components/map/MapThemeSwitcher";
import { STYLES, ensureWorker, prefersReducedMotion, resolveColors, resolveMissingStyleImages, useDarkScheme, useMapTheme } from "@/components/map/mapStyle";
import { ATTRACTIONS } from "@/lib/plan/attractions";
import { positionAt, type Timeline } from "@/lib/plan/playback";
import { clock, nycToday, weekdayOf, WEEKDAYS } from "@/lib/plan/time";
import type { LegMode, PointLabel } from "@/lib/plan/types";

export interface MapStop {
  key: string;
  name: string;
  lat: number;
  lon: number;
  /** Shown in the pin once the day is ordered. */
  number: number | null;
  photo?: string | null;
  /** "10:35am – 1:05pm", for the hover card. */
  time?: string | null;
}

export interface MapLeg {
  mode: LegMode;
  coordinates: [number, number][];
}

export interface PlanMapProps {
  stops: MapStop[];
  origin: PointLabel | null;
  legs: MapLeg[];
  /** Attraction ids already in the day, so their dots read as taken. */
  chosen: string[];
  activeKey: string | null;
  /** A catalog dot was tapped: show that place. */
  onPickAttraction: (id: string) => void;
  onPickStop: (key: string) => void;
  /** The planned day, to play back hour by hour with the city's crowds. */
  player?: { timeline: Timeline; dow: number } | null;
  /** Playback reached a stop (or left it). */
  onPlayerKey?: (key: string | null) => void;
  /** Fly here when it changes: the place being looked at. */
  focus?: { key: string; lat: number; lon: number } | null;
  /** Pixels at the bottom covered by something else (the panel as a sheet on phones). */
  bottomInset?: number;
  /** Places found by discovery: lettered pins, and the chosen one's detour through the day. */
  discover?: { points: { key: string; lat: number; lon: number; label: string }[]; selected: string | null; detour: [number, number][] | null } | null;
  onDiscoverSelect?: (key: string) => void;
  /** The map is mostly covered (a fully open sheet): hide the floating player. */
  hideOverlays?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  className?: string;
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const KIND_VAR: Record<string, string> = {
  museum: "--cat-nightlife",
  view: "--cat-subway",
  landmark: "--cat-entertainment",
  park: "--cat-parks",
  food: "--cat-restaurants",
  neighborhood: "--cat-groceries",
};
/** A whole day plays back in about this many seconds. */
const PLAY_SECONDS = 24;

/** Station weight at a fractional time: blend this hour's level into the next. */
function heatWeight(t: number): unknown {
  const h = Math.floor(t / 60) % 24;
  const f = (t % 60) / 60;
  return ["+", ["*", 1 - f, ["get", `h${h}`]], ["*", f, ["get", `h${(h + 1) % 24}`]]];
}

/** A small hexagon around a station. */
function hexagon(lon: number, lat: number, meters = 55): [number, number][] {
  const dLat = meters / 111_320;
  const dLon = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)] as [number, number];
  });
  return [...ring, ring[0]];
}

/** Compass bearing from a to b, in degrees. */
function bearingOf(a: [number, number], b: [number, number]): number {
  const k = Math.cos((a[1] * Math.PI) / 180);
  return (Math.atan2((b[0] - a[0]) * k, b[1] - a[1]) * 180) / Math.PI;
}

/** Turn toward a bearing gradually, the short way round. */
function easeBearing(from: number, to: number, f: number): number {
  const diff = ((to - from + 540) % 360) - 180;
  return from + diff * f;
}

/**
 * The day on a map. Catalog spots are dots you can tap for details; chosen stops are
 * photo pins; legs are drawn per mode (dotted walk, dashed bike, solid ride). A
 * planned day can be played back: a traveler follows the route while the city's
 * crowds, from subway ridership, rise and fall around it.
 * MapLibre is driven imperatively from props, as in CityMap.
 */
export function PlanMap(props: PlanMapProps) {
  const [kindFilter, setKindFilter] = useState<string>("all");
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const readyRef = useRef(false);
  const colors = useRef<Record<string, string>>({});
  const markers = useRef<Marker[]>([]);
  const traveler = useRef<Marker | null>(null);
  const heatData = useRef<{ dow: number; data: GeoJSON.FeatureCollection; columns: GeoJSON.FeatureCollection } | null>(null);
  /** Ride-along camera: where the traveler was last frame, which way the camera faces, when following may start. */
  const camera = useRef<{ last: [number, number] | null; bearing: number; from: number }>({ last: null, bearing: 0, from: 0 });
  const latest = useRef(props);
  const dark = useDarkScheme();

  const userMarker = useRef<Marker | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  function handleLocateMe() {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationStatus("Geolocation not supported by your browser");
      setTimeout(() => setLocationStatus(null), 3500);
      return;
    }
    setLocating(true);
    setLocationStatus("Finding your location…");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        setUserLocation([lng, lat]);
        setLocating(false);
        setLocationStatus("Location found!");

        const map = mapRef.current;
        if (!map) return;

        if (!userMarker.current) {
          const el = document.createElement("div");
          el.className = "relative flex size-6 items-center justify-center pointer-events-none";
          el.innerHTML = `
            <span class="absolute size-10 rounded-full bg-blue-500/25 animate-ping"></span>
            <span class="absolute size-7 rounded-full bg-blue-500/35"></span>
            <span class="size-4 rounded-full bg-blue-600 border-2 border-white shadow-lg"></span>
          `;
          const popup = new Popup({ offset: 12, closeButton: false }).setHTML(
            '<div class="px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400">You are here</div>'
          );
          userMarker.current = new Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map);
        } else {
          userMarker.current.setLngLat([lng, lat]);
        }

        map.flyTo({
          center: [lng, lat],
          zoom: Math.max(map.getZoom(), 14.5),
          duration: 1200,
        });

        setTimeout(() => setLocationStatus(null), 3500);
      },
      (err) => {
        setLocating(false);
        const msg = err.code === 1 ? "Location permission denied" : "Unable to acquire GPS location";
        setLocationStatus(msg);
        setTimeout(() => setLocationStatus(null), 3500);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  const timeline = props.player?.timeline ?? null;
  // Playback state belongs to one timeline; a new plan starts it over.
  const [scrub, setScrub] = useState<{ for: Timeline | null; t: number; engaged: boolean }>({ for: null, t: 0, engaged: false });
  const [playing, setPlaying] = useState(false);
  const [showHeat, setShowHeat] = useState(true);
  const [is3d, setIs3d] = useState(false);
  const [, setStyleLoads] = useState(0);
  const current = timeline && scrub.for === timeline ? scrub : timeline ? { for: timeline, t: timeline.startMin, engaged: false } : null;
  const t = current?.t ?? 0;
  const position = timeline && current ? positionAt(timeline, t) : null;
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    latest.current = props;
  });

  function applyCatalog(map: MapLibre) {
    const chosen = new Set(latest.current.chosen);
    (map.getSource("catalog") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: ATTRACTIONS.map((a) => ({
        type: "Feature" as const,
        properties: { id: a.id, name: a.name, kind: a.kind, color: colors.current[KIND_VAR[a.kind]], chosen: chosen.has(a.id) },
        geometry: { type: "Point" as const, coordinates: [a.lon, a.lat] },
      })),
    });
  }

  function applyLegs(map: MapLibre) {
    (map.getSource("legs") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: latest.current.legs.map((l) => ({
        type: "Feature" as const,
        properties: { mode: l.mode },
        geometry: { type: "LineString" as const, coordinates: l.coordinates },
      })),
    });
  }

  function applyFound(map: MapLibre) {
    const d = latest.current.discover;
    (map.getSource("found") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      // The chosen one last, so it draws on top.
      features: (d?.points ?? [])
        .map((p) => ({ ...p, selected: p.key === d?.selected }))
        .sort((a, b) => Number(a.selected) - Number(b.selected))
        .map((p) => ({ type: "Feature" as const, properties: { key: p.key, label: p.label, selected: p.selected }, geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] } })),
    });
    (map.getSource("detour") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: d?.detour && d.detour.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: d.detour } }] : [],
    });
  }

  function applyMarkers(map: MapLibre, pinCard: Popup) {
    for (const m of markers.current) m.remove();
    markers.current = [];
    const { stops, origin, activeKey } = latest.current;
    if (origin) {
      const el = document.createElement("div");
      el.className = "home-marker";
      el.setAttribute("aria-label", `Start: ${origin.label}`);
      el.innerHTML = `<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V21H3z"/></svg></span>`;
      markers.current.push(new Marker({ element: el }).setLngLat([origin.lon, origin.lat]).addTo(map));
    }
    for (const s of stops) {
      const el = document.createElement("button");
      el.type = "button";
      const photo = s.photo && s.number !== null;
      el.className = cn("plan-pin", photo && "has-photo", s.key === activeKey && "is-active");
      el.setAttribute("aria-label", s.number === null ? s.name : `Stop ${s.number}: ${s.name}`);
      if (photo) {
        el.style.backgroundImage = `url("${s.photo!.replace(/"/g, "%22")}")`;
        const badge = document.createElement("span");
        badge.textContent = String(s.number);
        el.append(badge);
      } else {
        el.textContent = s.number === null ? "" : String(s.number);
      }
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        latest.current.onPickStop(s.key);
      });
      el.addEventListener("mouseenter", () => {
        const root = document.createElement("div");
        if (s.photo) {
          const img = document.createElement("img");
          img.src = s.photo;
          img.alt = "";
          root.append(img);
        }
        const text = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = s.number === null ? s.name : `${s.number}. ${s.name}`;
        text.append(name);
        if (s.time) {
          const time = document.createElement("span");
          time.textContent = s.time;
          text.append(time);
        }
        root.append(text);
        pinCard.setLngLat([s.lon, s.lat]).setDOMContent(root).addTo(map);
      });
      el.addEventListener("mouseleave", () => pinCard.remove());
      markers.current.push(new Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(map));
    }
  }

  function frame(map: MapLibre) {
    const { stops, origin } = latest.current;
    const pts: [number, number][] = stops.map((s) => [s.lon, s.lat]);
    if (origin) pts.push([origin.lon, origin.lat]);
    if (!pts.length) return;
    const duration = prefersReducedMotion() ? 0 : 800;
    // Leave room for the chips above and the player below, in proportion on small maps.
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    const side = Math.min(64, w * 0.1);
    const inset = latest.current.bottomInset ?? 0;
    const below = inset ? inset + (latest.current.player ? 150 : 24) : latest.current.player ? Math.min(240, h * 0.38) : Math.min(64, h * 0.1);
    const padding = { top: Math.min(80, h * 0.2), right: side, bottom: Math.min(below, h * 0.78), left: side };
    if (pts.length === 1) return map.easeTo({ center: pts[0], zoom: 14.5, duration, padding });
    const bounds = new LngLatBounds(pts[0], pts[0]);
    for (const p of pts) bounds.extend(p);
    map.fitBounds(bounds, { padding, maxZoom: 15.5, duration });
  }

  const [mapTheme] = useMapTheme();
  const activeStyleKey = mapTheme || (dark ? "night" : "day");
  const activeStyle = STYLES[activeStyleKey] ?? (dark ? STYLES.night : STYLES.day);

  const pinCardRef = useRef<Popup | null>(null);

  useEffect(() => {
    if (!container.current) return;
    ensureWorker();
    const map = new MapLibre({
      container: container.current,
      style: activeStyle,
      center: [-73.985, 40.742],
      zoom: 11.6,
      minZoom: 9.5,
      maxZoom: 18,
      attributionControl: false,
      cooperativeGestures: window.matchMedia("(pointer: coarse)").matches,
    });
    resolveMissingStyleImages(map);
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    mapRef.current = map;
    const tooltip = new Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "rc-tooltip" });
    const pinCard = new Popup({ closeButton: false, closeOnClick: false, offset: 26, className: "pin-card", maxWidth: "240px" });
    pinCardRef.current = pinCard;

    map.on("style.load", () => {
      readyRef.current = false;
      colors.current = resolveColors();
      const c = colors.current;
      if (activeStyleKey === "night" && map.getLayer("background")) {
        map.setPaintProperty("background", "background-color", c["--background"]);
      }

      // The city's pulse: where people are, hour by hour, under everything else.
      if (!map.getSource("heat")) {
        map.addSource("heat", { type: "geojson", data: EMPTY });
      }
      if (!map.getLayer("heat")) {
        map.addLayer({
          id: "heat",
          type: "heatmap",
          source: "heat",
          layout: { visibility: "none" },
          paint: {
            "heatmap-weight": heatWeight(12 * 60) as never,
            "heatmap-radius": ["interpolate", ["exponential", 1.6], ["zoom"], 10, 14, 13, 38, 16, 110],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 1.4, 15, 2.2],
            "heatmap-opacity": 0.8,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(0,0,0,0)",
              0.1, "rgba(56,189,248,0.28)",
              0.3, "rgba(129,140,248,0.5)",
              0.5, "rgba(250,204,21,0.6)",
              0.72, "rgba(249,115,22,0.72)",
              1, "rgba(239,68,68,0.85)",
            ],
          },
        });
      }

      // 3D vector buildings: only attach if openmaptiles source exists in this style
      if (map.getSource("openmaptiles") && !map.getLayer("buildings-3d")) {
        try {
          map.addLayer({
            id: "buildings-3d",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 12,
            layout: { visibility: "none" },
            paint: {
              "fill-extrusion-color": c["--muted"],
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 10],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.82,
            },
          });
        } catch {
          // Source not ready or vector layer unavailable
        }
      }

      // Columns source kept inactive to avoid giant obstructing pillars
      if (!map.getSource("columns")) {
        map.addSource("columns", { type: "geojson", data: EMPTY });
      }
      if (!map.getLayer("columns")) {
        map.addLayer({
          id: "columns",
          type: "fill-extrusion",
          source: "columns",
          layout: { visibility: "none" },
          paint: { "fill-extrusion-opacity": 0, "fill-extrusion-base": 0 },
        });
      }

      if (!map.getSource("legs")) {
        map.addSource("legs", { type: "geojson", data: EMPTY });
      }
      if (!map.getLayer("legs-casing")) {
        map.addLayer({
          id: "legs-casing",
          type: "line",
          source: "legs",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": c["--background"], "line-width": 8, "line-opacity": 0.9 },
        });
      }
      const leg = (id: string, modes: LegMode[], paint: Record<string, unknown>) =>
        map.addLayer({
          id,
          type: "line",
          source: "legs",
          filter: ["in", ["get", "mode"], ["literal", modes]],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: paint as never,
        });
      leg("legs-subway", ["subway"], { "line-color": c["--cat-subway"], "line-width": 4.5 });
      leg("legs-car", ["car"], { "line-color": c["--foreground"], "line-width": 4 });
      leg("legs-bike", ["bike"], { "line-color": c["--cat-parks"], "line-width": 4, "line-dasharray": [2, 1.5] });
      leg("legs-walk", ["walk"], { "line-color": c["--brand"], "line-width": 4.5, "line-dasharray": [0.1, 1.9] });

      // The part of the day already played: a glowing trail over the route.
      map.addSource("trail", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "trail-glow",
        type: "line",
        source: "trail",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c["--brand"], "line-width": 14, "line-blur": 8, "line-opacity": 0.45 },
      });
      map.addLayer({
        id: "trail",
        type: "line",
        source: "trail",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c["--brand"], "line-width": 5 },
      });

      // Discovery preview: the detour a found place would add, and the found places.
      map.addSource("detour", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "detour-glow",
        type: "line",
        source: "detour",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#f97316", "line-width": 12, "line-blur": 6, "line-opacity": 0.35 },
      });
      map.addLayer({
        id: "detour",
        type: "line",
        source: "detour",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#f97316", "line-width": 4, "line-dasharray": [1.2, 1.4] },
      });
      map.addSource("found", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "found",
        type: "circle",
        source: "found",
        paint: {
          "circle-color": "#f97316",
          "circle-radius": ["case", ["get", "selected"], 15, 11],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["case", ["get", "selected"], 4, 2.5],
        },
      });
      map.addLayer({
        id: "found-label",
        type: "symbol",
        source: "found",
        layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-allow-overlap": true, "icon-allow-overlap": true },
        paint: { "text-color": "#ffffff" },
      });

      map.addSource("catalog", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "catalog",
        type: "circle",
        source: "catalog",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 15, 7],
          "circle-opacity": ["case", ["get", "chosen"], 0.25, 0.9],
          "circle-stroke-color": c["--card"],
          "circle-stroke-width": 1.5,
        },
      });
      map.addLayer({
        id: "catalog-label",
        type: "symbol",
        source: "catalog",
        minzoom: 13,
        filter: ["!", ["get", "chosen"]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-anchor": "top",
          "text-offset": [0, 0.8],
          "text-optional": true,
        },
        paint: { "text-color": c["--muted-foreground"], "text-halo-color": c["--card"], "text-halo-width": 1.6 },
      });
      readyRef.current = true;
      if (heatData.current) {
        (map.getSource("heat") as GeoJSONSource | undefined)?.setData(heatData.current.data);
        (map.getSource("columns") as GeoJSONSource | undefined)?.setData(heatData.current.columns);
      }
      applyCatalog(map);
      applyLegs(map);
      applyFound(map);
      applyMarkers(map, pinCard);
      frame(map);
      // Re-render so the playback layers are drawn onto the new style.
      setStyleLoads((n) => n + 1);
    });

    map.on("mousemove", "catalog", (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      map.getCanvas().style.cursor = "pointer";
      const root = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = String(f.properties.name);
      const hint = document.createElement("span");
      hint.textContent = f.properties.chosen ? "In your day · tap for details" : "Tap for photos, hours and crowds";
      root.append(name, hint);
      tooltip.setLngLat(f.geometry.coordinates as [number, number]).setDOMContent(root).addTo(map);
    });
    map.on("mouseleave", "catalog", () => {
      map.getCanvas().style.cursor = "";
      tooltip.remove();
    });
    map.on("click", "found", (e) => {
      const key = e.features?.[0]?.properties.key;
      if (key) latest.current.onDiscoverSelect?.(String(key));
    });
    map.on("mouseenter", "found", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "found", () => (map.getCanvas().style.cursor = ""));
    map.on("click", "catalog", (e) => {
      const id = e.features?.[0]?.properties.id;
      tooltip.remove();
      if (id) latest.current.onPickAttraction(String(id));
    });

    // Resize with the page; a big change (the phone map growing for a plan) reframes the day.
    let framedAt = { w: 0, h: 0 };
    const observer = new ResizeObserver(() => {
      map.resize();
      const { clientWidth: w, clientHeight: h } = map.getContainer();
      if (readyRef.current && (Math.abs(w - framedAt.w) > 80 || Math.abs(h - framedAt.h) > 80)) frame(map);
      framedAt = { w, h };
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      for (const m of markers.current) m.remove();
      markers.current = [];
      traveler.current?.remove();
      traveler.current = null;
      userMarker.current?.remove();
      userMarker.current = null;
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, [activeStyle, activeStyleKey, dark]);

  const run = (fn: (map: MapLibre) => void) => {
    const map = mapRef.current;
    if (map && readyRef.current) fn(map);
  };

  useEffect(() => run(applyCatalog), [props.chosen]);
  useEffect(() => {
    run((map) => {
      const filter = kindFilter === "all" ? null : ["==", ["get", "kind"], kindFilter];
      map.setFilter("catalog", filter as never);
      map.setFilter("catalog-label", kindFilter === "all" ? ["!", ["get", "chosen"]] : ["all", ["!", ["get", "chosen"]], ["==", ["get", "kind"], kindFilter]] as never);
    });
  }, [kindFilter]);
  useEffect(() => run(applyLegs), [props.legs]);

  // Discovery: draw the found places; frame them when they arrive, the detour when one is chosen.
  const foundKey = props.discover?.points.map((p) => p.key).join("|") ?? "";
  const detourKey = JSON.stringify(props.discover?.detour ?? null);
  useEffect(() => run(applyFound), [foundKey, detourKey, props.discover?.selected]);
  useEffect(() => {
    const d = latest.current.discover;
    if (!d?.points.length) return;
    run((map) => {
      const pts: [number, number][] = [...d.points.map((p) => [p.lon, p.lat] as [number, number]), ...(d.detour ?? [])];
      const bounds = new LngLatBounds(pts[0], pts[0]);
      for (const p of pts) bounds.extend(p);
      const { clientHeight: h } = map.getContainer();
      const inset = latest.current.bottomInset ?? 0;
      map.fitBounds(bounds, { padding: { top: 80, right: 50, bottom: Math.min(inset + 40, h * 0.7), left: 50 }, maxZoom: 16, duration: prefersReducedMotion() ? 0 : 700 });
    });
    // Reframe for a new set of results or a new detour, not for every render.
  }, [foundKey, detourKey]);
  useEffect(() => run((map) => applyMarkers(map, pinCardRef.current!)), [props.stops, props.origin, props.activeKey]);

  // Refit only when the set of places changes, not on every hover.
  const frameKey = [...props.stops.map((s) => s.key), props.origin?.label ?? ""].join("|");
  useEffect(() => run(frame), [frameKey]);

  // Fly to the place being looked at.
  const focusKey = props.focus?.key ?? null;
  useEffect(() => {
    const f = latest.current.focus;
    if (!f) return;
    run((map) => map.easeTo({ center: [f.lon, f.lat], zoom: Math.max(map.getZoom(), 14.2), duration: prefersReducedMotion() ? 0 : 900 }));
  }, [focusKey]);

  // Crowd levels for the plan's weekday (or today's, before there's a plan), once per weekday.
  const dow = props.player?.dow ?? weekdayOf(nycToday());
  useEffect(() => {
    if (heatData.current?.dow === dow) return;
    let cancelled = false;
    fetch(`/api/crowd-heat?dow=${dow}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { stations: number[][] } | null) => {
        if (cancelled || !body) return;
        const data: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: body.stations.map(([lon, lat, ...hours]) => ({
            type: "Feature",
            properties: Object.fromEntries(hours.map((v, h) => [`h${h}`, v])),
            geometry: { type: "Point", coordinates: [lon, lat] },
          })),
        };
        const columns: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: body.stations.map(([lon, lat, ...hours]) => ({
            type: "Feature",
            properties: Object.fromEntries(hours.map((v, h) => [`h${h}`, v])),
            geometry: { type: "Polygon", coordinates: [hexagon(lon, lat)] },
          })),
        };
        heatData.current = { dow, data, columns };
        run((map) => {
          (map.getSource("heat") as GeoJSONSource | undefined)?.setData(data);
          (map.getSource("columns") as GeoJSONSource | undefined)?.setData(columns);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dow]);

  // Draw the playback state: heat for the hour, the trail so far, the traveler.
  const engaged = current?.engaged ?? false;
  useEffect(() => {
    const draw = (map: MapLibre) => {
      // Heatmap visibility: visible when user toggles Crowds
      if (map.getLayer("heat")) {
        map.setLayoutProperty("heat", "visibility", showHeat ? "visible" : "none");
        if (timeline) {
          map.setPaintProperty("heat", "heatmap-weight", heatWeight(t) as never);
        }
      }
      // Vector buildings (only if layer exists in current style)
      if (map.getLayer("buildings-3d")) {
        map.setLayoutProperty("buildings-3d", "visibility", is3d ? "visible" : "none");
      }
      // Columns are permanently hidden to eliminate giant obstructing pillars
      if (map.getLayer("columns")) {
        map.setLayoutProperty("columns", "visibility", "none");
      }
      const trail = engaged && position ? position.trail.filter((p) => p.length > 1) : [];
      (map.getSource("trail") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: trail.map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } })),
      });
      if (engaged && position) {
        if (!traveler.current) {
          const el = document.createElement("div");
          el.className = "traveler-marker";
          el.setAttribute("aria-hidden", "true");
          traveler.current = new Marker({ element: el }).setLngLat(position.at).addTo(map);
        } else traveler.current.setLngLat(position.at);
      } else {
        traveler.current?.remove();
        traveler.current = null;
      }
      // Ride along in 3D: follow the traveler, facing where they're heading; circle slowly at a stop.
      const cam = camera.current;
      if (is3d && playing && position && performance.now() >= cam.from) {
        const moved = cam.last ? Math.hypot(position.at[0] - cam.last[0], position.at[1] - cam.last[1]) : 0;
        cam.bearing = moved > 1e-6 ? easeBearing(cam.bearing, bearingOf(cam.last!, position.at), 0.08) : cam.bearing + 0.12;
        // Keep the traveler in the open map above the player card (and the sheet, on phones).
        const bottom = Math.min((latest.current.bottomInset ?? 0) + 260, map.getContainer().clientHeight * 0.7);
        map.jumpTo({ center: position.at, bearing: cam.bearing, pitch: 62, zoom: 15.4, padding: { top: 0, right: 0, bottom, left: 0 } });
      }
      cam.last = position?.at ?? null;
    };
    run(draw);
  });

  // Tell the itinerary which stop the playback is at.
  const positionKey = engaged ? (position?.key ?? null) : null;
  useEffect(() => {
    if (positionKey === lastKey.current) return;
    lastKey.current = positionKey;
    if (positionKey) latest.current.onPlayerKey?.(positionKey);
  }, [positionKey]);

  // Playback: advance the clock every frame, from wherever the scrubber is.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  useEffect(() => {
    if (!playing || !timeline) return;
    const rate = (timeline.endMin - timeline.startMin) / PLAY_SECONDS / 1000;
    let now = tRef.current >= timeline.endMin ? timeline.startMin : tRef.current;
    let last = performance.now();
    let raf = 0;
    const tick = (at: number) => {
      now = Math.min(timeline.endMin, now + (at - last) * rate);
      last = at;
      setScrub({ for: timeline, t: now, engaged: true });
      if (now >= timeline.endMin) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, timeline]);

  // The sheet settled at a new height: keep the day in the visible part of the map.
  useEffect(() => {
    if (!playing) run(frame);
    // Only the inset matters here; playback owns the camera while it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.bottomInset]);

  useEffect(() => {
    latest.current.onPlayingChange?.(playing);
  }, [playing]);

  // Tilt into 3D and back.
  useEffect(() => {
    run((map) => {
      const duration = prefersReducedMotion() ? 0 : 1400;
      if (is3d) {
        // Tilt, then fit the day into the tilted view.
        map.easeTo({ pitch: 58, bearing: -24, zoom: Math.max(map.getZoom(), 13.4), duration });
        if (latest.current.stops.length) map.once("moveend", () => frame(map));
      }
      else map.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, duration });
    });
  }, [is3d]);

  // A 3D playback that finishes pulls back to show the whole day.
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (wasPlaying.current && !playing && is3d) run(frame);
    wasPlaying.current = playing;
  });

  const ended = timeline !== null && t >= timeline.endMin;
  function togglePlay() {
    if (!timeline) return;
    const start = ended ? timeline.startMin : t;
    setScrub({ for: timeline, t: start, engaged: true });
    const starting = !playing || ended;
    setPlaying(starting);
    if (starting && is3d) {
      // Swoop down to the traveler first, then follow.
      const at = positionAt(timeline, start)?.at;
      const duration = prefersReducedMotion() ? 0 : 1400;
      camera.current = { last: null, bearing: mapRef.current?.getBearing() ?? 0, from: performance.now() + duration };
      if (at) {
        run((map) => {
          const bottom = Math.min((latest.current.bottomInset ?? 0) + 260, map.getContainer().clientHeight * 0.7);
          map.flyTo({ center: at, zoom: 15.4, pitch: 62, bearing: camera.current.bearing, duration, padding: { top: 0, right: 0, bottom, left: 0 } });
        });
      }
    }
  }

  const hours = timeline ? Array.from({ length: Math.floor(timeline.endMin / 60) - Math.ceil(timeline.startMin / 60) + 1 }, (_, i) => Math.ceil(timeline.startMin / 60) + i) : [];

  return (
    <div className={cn("relative", props.discover?.points.length && "is-discovering", props.className)}>
      <div ref={container} className="size-full" role="region" aria-label="Map of your day" />
      <div
        className={cn(
          "neo-inset absolute top-14 left-3 z-10 flex max-w-[calc(100%-4rem)] gap-1 overflow-x-auto rounded-2xl p-1.5 backdrop-blur-md [scrollbar-width:none]",
          // On a phone the planned day needs the room; exploring is for building it.
          props.player && "max-sm:hidden",
        )}
        aria-label="Explore places by type"
      >
        {[
          { id: "all", label: "Explore" },
          { id: "view", label: "Views" },
          { id: "food", label: "Food" },
          { id: "museum", label: "Museums" },
          { id: "park", label: "Parks" },
          { id: "landmark", label: "Landmarks" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={kindFilter === item.id}
            onClick={() => setKindFilter(item.id)}
            className={cn(
              "shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200",
              kindFilter === item.id ? "neo-control font-bold text-brand shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="absolute top-[106px] left-2.5 z-10 hidden sm:block">
        <MapThemeSwitcher showLayersDialog={true} />
      </div>

      <div className="absolute top-[106px] right-2.5 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          title={userLocation ? "Re-center on my location" : "Show my location on the map"}
          aria-label="Locate me"
          className={cn(
            "grid size-8 place-items-center rounded-xl text-[11px] font-bold transition shadow-xs",
            userLocation ? "neo-raised text-blue-500 font-bold" : "neo-control text-foreground",
            locating && "animate-pulse"
          )}
        >
          <Crosshair className={cn("size-4", locating && "animate-spin text-brand")} aria-hidden />
        </button>

        <button
          type="button"
          aria-pressed={is3d}
          onClick={() => setIs3d((v) => !v)}
          title={is3d ? "Back to flat map" : "See the city in 3D perspective"}
          className={cn(
            "grid size-8 place-items-center rounded-xl text-[11px] font-bold transition",
            is3d ? "neo-primary" : "neo-control text-foreground",
          )}
        >
          {is3d ? "2D" : "3D"}
        </button>
      </div>

      {locationStatus && (
        <div className="neo-raised absolute top-28 left-1/2 -translate-x-1/2 z-20 rounded-xl px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md animate-rise shadow-md border">
          {locationStatus}
        </div>
      )}
      {is3d && !timeline && (
        <div
          style={props.bottomInset ? { bottom: props.bottomInset + 10 } : undefined}
          className="neo-raised pointer-events-none absolute bottom-8 left-3 z-10 max-w-xs animate-rise rounded-2xl px-4 py-3 text-xs backdrop-blur-xl border">
          <p className="flex items-center gap-1.5 font-semibold">
            <Box className="size-3.5 text-brand" aria-hidden /> 3D Perspective Mode
          </p>
          <p className="mt-0.5 text-muted-foreground">Tilted aerial view with elevation terrain. Follow your itinerary routes and explore the city from above.</p>
        </div>
      )}

      {timeline && props.player && !props.hideOverlays && (
        <div
          style={props.bottomInset ? { bottom: props.bottomInset + 10 } : undefined}
          className="neo-raised-lg absolute right-2 bottom-7 left-2 z-10 mx-auto max-w-2xl animate-rise rounded-3xl p-3 sm:right-3 sm:bottom-8 sm:left-3 sm:p-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : ended ? "Replay your day" : "Play your day"}
              className={cn(
                "neo-primary relative grid size-10 shrink-0 place-items-center sm:size-12 rounded-full transition hover:scale-105 active:scale-95",
                !engaged && "play-halo",
              )}
            >
              {playing ? <Pause className="size-5" aria-hidden /> : ended ? <RotateCcw className="size-5" aria-hidden /> : <Play className="size-5 translate-x-px" aria-hidden />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl leading-none tabular-nums sm:text-3xl">{clock(t)}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground" aria-live="polite">
                {engaged
                  ? (position?.label ?? "")
                  : is3d
                    ? `Ride along your ${WEEKDAYS[props.player.dow]} in 3D`
                    : `Play your ${WEEKDAYS[props.player.dow]}: watch the route and the city's crowds`}
              </p>
            </div>
            <button
              type="button"
              aria-pressed={showHeat}
              onClick={() => setShowHeat((v) => !v)}
              className={cn(
                "neo-control inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                showHeat && "neo-inset text-brand",
              )}
            >
              <Flame className="size-3.5" aria-hidden /> Crowds
            </button>
          </div>
          <div className="relative mt-1.5 sm:mt-3">
            <input
              type="range"
              min={timeline.startMin}
              max={timeline.endMin}
              step={1}
              value={Math.round(t)}
              onChange={(e) => {
                setPlaying(false);
                setScrub({ for: timeline, t: Number(e.target.value), engaged: true });
              }}
              aria-label="Time of day"
              aria-valuetext={clock(t)}
              className="day-scrubber w-full"
              style={{ "--progress": `${((t - timeline.startMin) / (timeline.endMin - timeline.startMin)) * 100}%` } as React.CSSProperties}
            />
            <div className="pointer-events-none mt-1 flex justify-between max-sm:hidden text-[10px] text-muted-foreground tabular-nums" aria-hidden>
              {hours.filter((_, i) => i % Math.ceil(hours.length / 7) === 0).map((h) => (
                <span key={h}>{clock(h * 60).replace(":00", "")}</span>
              ))}
            </div>
          </div>
          {showHeat && (
            <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground max-sm:hidden">
              <span>Quiet</span>
              <span className="heat-legend h-1.5 flex-1 rounded-full" aria-hidden />
              <span>Packed</span>
              <span className="max-sm:hidden">
                · subway riders, typical {WEEKDAYS[props.player.dow]}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
