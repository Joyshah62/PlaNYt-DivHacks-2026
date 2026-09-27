"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { AttributionControl, LngLatBounds, Map as MapLibre, Marker, type GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { ensureWorker, keepAttributionCollapsed, resolveMissingStyleImages, STYLES, useDarkScheme } from "../bridge/map";
import { AVATAR_HEX, type Avatar } from "../core/avatars";

export interface MapPerson {
  id: string;
  name: string;
  avatar: Avatar;
  lat: number;
  lon: number;
}
export interface MapStop {
  key: string;
  name: string;
  lat: number;
  lon: number;
}

const EMPTY = { type: "FeatureCollection" as const, features: [] };

/** Marker elements are built from text only; names come from users, so nothing is parsed as HTML. */
function pin(text: string, className: string, title: string) {
  const el = document.createElement("div");
  el.className = className;
  el.title = title;
  el.textContent = text;
  return el;
}

/** Everyone's starting point, their way to the start, and the day's stops. */
export default function RoomMap({ people, stops, origin }: { people: MapPerson[]; stops: MapStop[]; origin: { label: string; lat: number; lon: number } | null }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const dark = useDarkScheme();

  useEffect(() => {
    if (!container.current) return;
    ensureWorker();
    const map = new MapLibre({ container: container.current, style: dark ? STYLES.dark : STYLES.light, center: [-73.97, 40.74], zoom: 11, attributionControl: false, fadeDuration: 0 });
    resolveMissingStyleImages(map);
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    const stopWatchingAttribution = keepAttributionCollapsed(map);
    // Pins are plain DOM markers, so show them even if the map tiles never arrive.
    const failSafe = window.setTimeout(() => setReady(true), 4000);
    map.on("load", () => {
      window.clearTimeout(failSafe);
      map.addSource("room-legs", { type: "geojson", data: EMPTY });
      map.addSource("room-route", { type: "geojson", data: EMPTY });
      map.addLayer({ id: "room-legs", type: "line", source: "room-legs", paint: { "line-color": ["get", "color"], "line-width": 2.5, "line-dasharray": [1.5, 1.5], "line-opacity": 0.9 } });
      map.addLayer({ id: "room-route", type: "line", source: "room-route", paint: { "line-color": dark ? "#f3efe9" : "#1d1a18", "line-width": 3, "line-opacity": 0.85 } });
      setReady(true);
    });
    mapRef.current = map;
    // The panel settles its size after the map starts (fonts, the grid, a tab shown), and MapLibre only watches the window.
    const sized = new ResizeObserver(() => map.resize());
    sized.observe(container.current);
    return () => {
      sized.disconnect();
      window.clearTimeout(failSafe);
      markers.current.forEach((m) => m.remove());
      stopWatchingAttribution();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [dark]);

  const dataKey = JSON.stringify([people, stops, origin]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const [ppl, stp, org] = JSON.parse(dataKey) as [MapPerson[], MapStop[], typeof origin];
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const start = org ?? stp[0] ?? null;

    (map.getSource("room-legs") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: start
        ? ppl.map((p) => ({ type: "Feature", properties: { color: AVATAR_HEX[p.avatar.color] }, geometry: { type: "LineString", coordinates: [[p.lon, p.lat], [start.lon, start.lat]] } }))
        : [],
    });
    const routePoints = [...(org ? [org] : []), ...stp];
    (map.getSource("room-route") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: routePoints.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routePoints.map((s) => [s.lon, s.lat]) } }] : [],
    });

    const bounds = new LngLatBounds();
    stp.forEach((s, i) => {
      const el = pin(`${i + 1}`, "tr-pin tr-pin--stop", s.name);
      markers.current.push(new Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(map));
      bounds.extend([s.lon, s.lat]);
    });
    if (org) {
      const el = pin(`★ ${org.label}`, "tr-pin tr-pin--origin", org.label);
      markers.current.push(new Marker({ element: el }).setLngLat([org.lon, org.lat]).addTo(map));
      bounds.extend([org.lon, org.lat]);
    }
    ppl.forEach((p) => {
      const el = pin(p.avatar.emoji, "tr-avatar-pin", p.name);
      el.style.boxShadow = `0 0 0 2px ${AVATAR_HEX[p.avatar.color]}`;
      markers.current.push(new Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map));
      bounds.extend([p.lon, p.lat]);
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 600 });
  }, [dataKey, ready]);

  return <div ref={container} className="h-full w-full" aria-label="Map of where everyone starts and the day's stops" role="img" />;
}
