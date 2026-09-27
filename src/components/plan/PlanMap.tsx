"use client";

import { useEffect, useRef, useState } from "react";
import { AttributionControl, LngLatBounds, Map as MapLibre, Marker, Popup, type GeoJSONSource } from "maplibre-gl";
import { Box, Compass, Crosshair, Ellipsis, Layers3, Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import "maplibre-gl/dist/maplibre-gl.css";
import { rangeToZoom, zoomToRange, type Camera } from "@/components/home/camera";
import { readEnv } from "@/components/home/cityMap";
import { MapThemeSwitcher } from "@/components/map/MapThemeSwitcher";
import { STYLES, ensureWorker, keepAttributionCollapsed, prefersReducedMotion, resolveColors, resolveMissingStyleImages, useDarkScheme, useMapTheme } from "@/components/map/mapStyle";
import { ATTRACTIONS, KIND_LABELS, type AttractionKind } from "@/lib/plan/attractions";
import { positionAt, type Timeline } from "@/lib/plan/playback";
import { clock } from "@/lib/plan/time";
import type { LegMode, PointLabel } from "@/lib/plan/types";
import { PlanMap3D, type PlanMap3DHandle } from "./PlanMap3D";

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
  /** A place picked on Google's 3D map (not a catalog dot): show it. */
  onPickPlace?: (place: { name: string; lat: number; lon: number }) => void;
  /** The planned day, to play back hour by hour with the city's crowds. */
  player?: { timeline: Timeline; dow: number } | null;
  /** Playback reached a stop (or left it). */
  onPlayerKey?: (key: string | null) => void;
  /** Fly here when it changes: the place being looked at. With a name, and not in the day, it gets a pin. */
  focus?: { key: string; lat: number; lon: number; name?: string } | null;
  /** Pixels at the bottom covered by something else (the panel as a sheet on phones). */
  bottomInset?: number;
  /** Places found by discovery: lettered pins, and the chosen one's detour through the day. */
  discover?: { points: { key: string; lat: number; lon: number; label: string }[]; selected: string | null; detour: [number, number][] | null } | null;
  onDiscoverSelect?: (key: string) => void;
  /** The map is mostly covered (a fully open sheet): hide the floating player. */
  hideOverlays?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  /** The place-type filter over the map: only while picking places. */
  showFilter?: boolean;
  className?: string;
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** One colour per kind of place, for the dots and the legend: distinct on the satellite and the street maps. */
export const KIND_COLOR: Record<AttractionKind, string> = {
  museum: "#3d5a98",
  view: "#c8321f",
  landmark: "#7b4fa6",
  park: "#3f8a52",
  food: "#d98a1c",
  neighborhood: "#1f7f86",
};
const KINDS = Object.keys(KIND_LABELS) as AttractionKind[];
const COUNT = Object.fromEntries(KINDS.map((k) => [k, ATTRACTIONS.filter((a) => a.kind === k).length])) as Record<AttractionKind, number>;
/** A whole day plays back in about this many seconds. */
const PLAY_SECONDS = 24;

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
  // The legend: which kinds of place show, and whether it's open (by default, only while picking places).
  const [hiddenKinds, setHiddenKinds] = useState<AttractionKind[]>([]);
  const [legendOpen, setLegendOpen] = useState<boolean | null>(null);
  const legendShown = legendOpen ?? !!props.showFilter;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const readyRef = useRef(false);
  const colors = useRef<Record<string, string>>({});
  const markers = useRef<Marker[]>([]);
  const traveler = useRef<Marker | null>(null);
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
  const [is3d, setIs3d] = useState(false);
  // 3D is Google's photorealistic city, drawn over this map; 2D stays MapLibre. Without a key or
  // WebGL, with NEXT_PUBLIC_MAP_ENGINE=maplibre, or if Google fails, 3D tilts this map instead.
  const [googleOk, setGoogleOk] = useState(() => {
    if (typeof window === "undefined") return false;
    const env = readEnv();
    return env.webgl && env.hasKey && env.forced !== "maplibre";
  });
  const google3d = is3d && googleOk;
  const libre3d = is3d && !googleOk;
  const map3d = useRef<PlanMap3DHandle>(null);
  const [open3d, setOpen3d] = useState<Camera | null>(null);

  /** Switch between the flat map and 3D in place: the new view starts where the old one was. */
  function setView3d(next: boolean) {
    const flat = mapRef.current;
    if (next && flat) {
      const c = flat.getCenter();
      setOpen3d({ lat: c.lat, lng: c.lng, alt: 0, range: zoomToRange(flat.getZoom()), tilt: 55, heading: flat.getBearing() });
    } else if (!next && google3d) {
      const c = map3d.current?.camera();
      if (c) flat?.jumpTo({ center: [c.lng, c.lat], zoom: rangeToZoom(c.range), bearing: c.heading, pitch: 0 });
    }
    setIs3d(next);
  }
  const [moreTools, setMoreTools] = useState(false);
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
        properties: { id: a.id, name: a.name, kind: a.kind, chosen: chosen.has(a.id) },
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
      el.setAttribute("role", "img");
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
      // The preview card: on hover, and on keyboard focus too.
      const preview = () => {
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
      };
      el.addEventListener("mouseenter", preview);
      el.addEventListener("focus", preview);
      el.addEventListener("mouseleave", () => pinCard.remove());
      el.addEventListener("blur", () => pinCard.remove());
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
    const stopWatchingAttribution = keepAttributionCollapsed(map);
    mapRef.current = map;
    const tooltip = new Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "rc-tooltip" });
    const pinCard = new Popup({ closeButton: false, closeOnClick: false, offset: 26, className: "pin-card", maxWidth: "240px" });
    pinCardRef.current = pinCard;

    map.on("style.load", () => {
      readyRef.current = false;
      colors.current = resolveColors(map.getContainer());
      const c = colors.current;
      if (activeStyleKey === "night" && map.getLayer("background")) {
        map.setPaintProperty("background", "background-color", c["--background"]);
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

      if (!map.getSource("legs")) {
        map.addSource("legs", { type: "geojson", data: EMPTY });
      }
      // Route ink follows the map, not the page: dark ink on the light styles, paper on night and satellite.
      const darkMap = activeStyleKey === "night" || activeStyleKey === "satellite";
      const ink = darkMap ? "#efe8da" : "#15120e";
      const halo = darkMap ? "#1a1815" : "#f3ede1";
      if (!map.getLayer("legs-casing")) {
        map.addLayer({
          id: "legs-casing",
          type: "line",
          source: "legs",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": halo, "line-width": 8, "line-opacity": 0.9 },
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
      // Editorial ink: the subway in red, everything on foot or wheels in ink.
      leg("legs-subway", ["subway"], { "line-color": c["--brand"], "line-width": 4.5 });
      leg("legs-car", ["car", "taxi"], { "line-color": ink, "line-width": 4 });
      leg("legs-bike", ["bike"], { "line-color": ink, "line-width": 4, "line-dasharray": [0.1, 1.9] });
      leg("legs-walk", ["walk"], { "line-color": ink, "line-width": 3.5, "line-dasharray": [2, 1.5] });

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
        paint: { "line-color": c["--brand"], "line-width": 12, "line-blur": 6, "line-opacity": 0.3 },
      });
      map.addLayer({
        id: "detour",
        type: "line",
        source: "detour",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c["--brand"], "line-width": 4, "line-dasharray": [1.2, 1.4] },
      });
      map.addSource("found", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "found",
        type: "circle",
        source: "found",
        paint: {
          "circle-color": c["--brand"],
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
          // Places to explore, coloured by kind (see the legend); ones already in the day step back.
          "circle-color": ["match", ["get", "kind"], ...KINDS.flatMap((k) => [k, KIND_COLOR[k]]), ink] as never,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4.5, 13, 6.5, 16, 9],
          "circle-opacity": ["case", ["get", "chosen"], 0.35, 1],
          "circle-stroke-color": "#f3ede1",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 15, 2.5],
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
        paint: { "text-color": ink, "text-halo-color": halo, "text-halo-width": 1.6 },
      });
      readyRef.current = true;
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
      tooltip
        .setLngLat(f.geometry.coordinates as [number, number])
        .setDOMContent(root)
        .addTo(map);
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
      stopWatchingAttribution();
      map.remove();
      mapRef.current = null;
    };
  }, [activeStyle, activeStyleKey, dark]);

  const run = (fn: (map: MapLibre) => void) => {
    const map = mapRef.current;
    if (map && readyRef.current) fn(map);
  };

  useEffect(() => run(applyCatalog), [props.chosen]);
  const hiddenKey = hiddenKinds.join("|");
  useEffect(() => {
    run((map) => {
      const shown = ["!", ["in", ["get", "kind"], ["literal", hiddenKinds]]];
      map.setFilter("catalog", (hiddenKinds.length ? shown : null) as never);
      map.setFilter("catalog-label", (hiddenKinds.length ? ["all", ["!", ["get", "chosen"]], shown] : ["!", ["get", "chosen"]]) as never);
    });
    // `hiddenKey` stands for the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenKey]);
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
      map.fitBounds(bounds, {
        padding: { top: 80, right: 50, bottom: Math.min(inset + 40, h * 0.7), left: 50 },
        maxZoom: 16,
        duration: prefersReducedMotion() ? 0 : 700,
      });
    });
    // Reframe for a new set of results or a new detour, not for every render.
  }, [foundKey, detourKey]);
  useEffect(() => run((map) => applyMarkers(map, pinCardRef.current!)), [props.stops, props.origin, props.activeKey]);

  // Refit only when the set of places changes, not on every hover.
  const frameKey = [...props.stops.map((s) => s.key), props.origin?.label ?? ""].join("|");
  useEffect(() => run(frame), [frameKey]);

  // Fly to the place being looked at; a place that isn't in the day is marked and named.
  const focusKey = props.focus?.key ?? null;
  const focusPin = useRef<Marker | null>(null);
  useEffect(() => {
    focusPin.current?.remove();
    focusPin.current = null;
    const f = latest.current.focus;
    if (!f) return;
    run((map) => {
      if (f.name && !latest.current.stops.some((s) => s.key === f.key)) {
        const el = document.createElement("div");
        el.className = "focus-pin";
        el.textContent = f.name;
        focusPin.current = new Marker({ element: el, anchor: "bottom" }).setLngLat([f.lon, f.lat]).addTo(map);
      }
      map.easeTo({ center: [f.lon, f.lat], zoom: Math.max(map.getZoom(), 15), duration: prefersReducedMotion() ? 0 : 900 });
    });
    return () => {
      focusPin.current?.remove();
      focusPin.current = null;
    };
  }, [focusKey]);

  // Draw the playback state: the trail so far, the traveler.
  const engaged = current?.engaged ?? false;
  useEffect(() => {
    const draw = (map: MapLibre) => {
      // Vector buildings (only if layer exists in current style)
      if (map.getLayer("buildings-3d")) {
        map.setLayoutProperty("buildings-3d", "visibility", libre3d ? "visible" : "none");
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
        if (libre3d) map.jumpTo({ center: position.at, bearing: cam.bearing, pitch: 62, zoom: 15.4, padding: { top: 0, right: 0, bottom, left: 0 } });
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

  // Tilt into 3D and back (MapLibre's 3D only: Google's lies over a flat map).
  useEffect(() => {
    run((map) => {
      const duration = prefersReducedMotion() ? 0 : 1400;
      if (libre3d) {
        // Tilt, then fit the day into the tilted view.
        map.easeTo({ pitch: 58, bearing: -24, zoom: Math.max(map.getZoom(), 13.4), duration });
        if (latest.current.stops.length) map.once("moveend", () => frame(map));
      } else map.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, duration });
    });
  }, [libre3d]);

  // A 3D playback that finishes pulls back to show the whole day.
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (wasPlaying.current && !playing && libre3d) run(frame);
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
      const duration = prefersReducedMotion() || google3d ? 0 : 1400;
      camera.current = { last: null, bearing: mapRef.current?.getBearing() ?? 0, from: performance.now() + duration };
      if (at && libre3d) {
        run((map) => {
          const bottom = Math.min((latest.current.bottomInset ?? 0) + 260, map.getContainer().clientHeight * 0.7);
          map.flyTo({ center: at, zoom: 15.4, pitch: 62, bearing: camera.current.bearing, duration, padding: { top: 0, right: 0, bottom, left: 0 } });
        });
      }
    }
  }

  const inset = props.bottomInset ? { bottom: props.bottomInset + 10 } : undefined;

  return (
    <div className={cn("relative", props.discover?.points.length && "is-discovering", props.className)}>
      <div ref={container} className="size-full" role="region" aria-label="Map of your day" />
      {google3d && (
        <PlanMap3D
          ref={map3d}
          initial={open3d ?? { lat: 40.742, lng: -73.985, alt: 0, range: 9000, tilt: 55, heading: 0 }}
          stops={props.stops}
          origin={props.origin}
          legs={props.legs}
          follow={playing && position ? position.at : null}
          camera={camera}
          traveler={engaged && position ? position.at : null}
          focus={props.focus ?? null}
          onPickStop={(key) => latest.current.onPickStop(key)}
          onPickPlace={(place) => latest.current.onPickPlace?.(place)}
          onFail={() => setGoogleOk(false)}
        />
      )}

      {/* Top left: what to show. Top right: how to look. Bottom: the day, played. */}
      {/* The legend: what the dots are, and a switch for each kind. */}
      <div className="pl-legend">
        <button type="button" aria-expanded={legendShown} aria-controls="map-legend" onClick={() => setLegendOpen(!legendShown)} className="pl-legend-toggle">
          <Layers3 aria-hidden /> Places
        </button>
        {legendShown && (
          <ul id="map-legend" role="group" aria-label="Show places by type">
            {KINDS.map((k) => {
              const on = !hiddenKinds.includes(k);
              return (
                <li key={k}>
                  <button type="button" aria-pressed={on} onClick={() => setHiddenKinds((list) => (on ? [...list, k] : list.filter((x) => x !== k)))}>
                    <i style={{ background: KIND_COLOR[k] }} aria-hidden />
                    <span>{KIND_LABELS[k]}</span>
                    <span className="pl-muted">{COUNT[k]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="pl-maptools" style={{ top: "var(--s-1)", right: "var(--s-1)" }}>
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => (google3d ? map3d.current?.zoom(1) : mapRef.current?.zoomIn())} className="pl-maptool">
          <Plus aria-hidden />
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => (google3d ? map3d.current?.zoom(-1) : mapRef.current?.zoomOut())} className="pl-maptool">
          <Minus aria-hidden />
        </button>
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          title={userLocation ? "Re-center on my location" : "Show my location on the map"}
          aria-label="Locate me"
          aria-pressed={userLocation !== null}
          className="pl-maptool"
        >
          <Crosshair className={cn(locating && "animate-spin")} aria-hidden />
        </button>
        {/* Everyday tools show; the rest wait behind "More". */}
        <button
          type="button"
          aria-expanded={moreTools}
          aria-label={moreTools ? "Fewer map tools" : "More map tools"}
          title="More map tools"
          onClick={() => setMoreTools((v) => !v)}
          className="pl-maptool"
        >
          <Ellipsis aria-hidden />
        </button>
        {moreTools && (
          <>
            <button
              type="button"
              aria-label="Reset the map to north up"
              title="North up"
              onClick={() => {
                // Flat and facing north again, so leave 3D too.
                setView3d(false);
                mapRef.current?.resetNorthPitch({ duration: prefersReducedMotion() ? 0 : 500 });
              }}
              className="pl-maptool"
            >
              <Compass aria-hidden />
            </button>
            <button
              type="button"
              aria-pressed={is3d}
              onClick={() => setView3d(!is3d)}
              title={is3d ? "Back to the flat map" : "See the city in 3D"}
              className="pl-maptool"
            >
              {is3d ? "2D" : "3D"}
            </button>
            <MapThemeSwitcher />
          </>
        )}
      </div>

      {locationStatus && (
        <p role="status" className="pl-mapnote" style={{ top: "var(--s-1)", left: "50%", transform: "translateX(-50%)" }}>
          {locationStatus}
        </p>
      )}
      {is3d && !timeline && (
        <p
          className="pl-mapnote pointer-events-none flex items-center gap-2"
          style={{ left: "var(--s-1)", bottom: inset?.bottom ?? "calc(var(--s-1) + 1.6em)" }}
        >
          <Box className="size-4 pl-red" aria-hidden /> {google3d ? "3D view: the city in Google's photorealistic 3D." : "3D view: a tilted aerial look at the city."}
        </p>
      )}

      {timeline && props.player && !props.hideOverlays && (
        // Quiet until used: a small "Play your day" pill, which becomes a one-line scrubber once the day is playing.
        <div style={inset} className={cn("pl-player", engaged && "engaged")}>
          <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : ended ? "Replay your day" : "Play your day"} className="pl-play">
            {playing ? <Pause aria-hidden /> : ended ? <RotateCcw aria-hidden /> : <Play className="translate-x-px" aria-hidden />}
          </button>
          {engaged ? (
            <>
              <span className="pl-clock">{clock(t)}</span>
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
                className="pl-scrub"
                style={{ "--progress": `${((t - timeline.startMin) / (timeline.endMin - timeline.startMin)) * 100}%` } as React.CSSProperties}
              />
            </>
          ) : (
            <button type="button" onClick={togglePlay} tabIndex={-1} className="pl-player-label">
              {is3d ? "Ride along in 3D" : "Watch your day"}
            </button>
          )}
          <span className="sr-only" aria-live="polite">
            {engaged ? (position?.label ?? "") : ""}
          </span>
        </div>
      )}
    </div>
  );
}
