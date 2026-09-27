"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";
import { fitStops, type Camera } from "@/components/home/camera";
import { loadMaps3d, onAuthFailure } from "@/components/home/cityMapGoogle";
import type { PointLabel } from "@/lib/plan/types";
import type { MapLeg, MapStop } from "./PlanMap";

type Maps3d = Awaited<ReturnType<typeof loadMaps3d>>;
type Map3D = google.maps.maps3d.Map3DElement;

export interface PlanMap3DHandle {
  zoom(by: 1 | -1): void;
  /** Where the camera is now, to hand the same view back to the flat map. */
  camera(): Camera | null;
}

/** Where the camera starts while the day is framed: Midtown, tilted like the 2D map's 3D. */
const START: Camera = { lat: 40.742, lng: -73.985, alt: 0, range: 9000, tilt: 58, heading: -24 };
const INK = "#15120e";
const PAPER = "#f3ede1";
const RED = "#c8321f";

const toCam = (c: Camera) => ({ center: { lat: c.lat, lng: c.lng, altitude: c.alt }, range: c.range, tilt: c.tilt, heading: c.heading });

/**
 * The planner's 3D view on Google's photorealistic city: the day's route and numbered stops,
 * and the traveler during playback, followed by the camera. Laid over the 2D (MapLibre) map
 * while 3D is on; `onFail` hands back to MapLibre's tilted view when Google can't draw it.
 */
export const PlanMap3D = forwardRef<
  PlanMap3DHandle,
  {
    /** Where to open: the view the flat map had, so switching to 3D stays in place. */
    initial: Camera;
    stops: MapStop[];
    origin: PointLabel | null;
    legs: MapLeg[];
    /** Where the traveler is while the day plays: the camera follows. */
    follow: [number, number] | null;
    /** The 2D map's ride-along camera, which works out the heading to face. */
    camera: RefObject<{ bearing: number }>;
    traveler: [number, number] | null;
    onPickStop: (key: string) => void;
    onFail: () => void;
  }
>(function PlanMap3D({ initial, stops, origin, legs, follow, camera, traveler, onPickStop, onFail }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const [lib, setLib] = useState<{ maps: Maps3d; map: Map3D } | null>(null);
  const latest = useRef({ onPickStop, onFail });
  const opening = useRef(initial);
  useEffect(() => {
    latest.current = { onPickStop, onFail };
  });

  // Build the map once; hand back to MapLibre on any failure.
  useEffect(() => {
    let live = true;
    let map: Map3D | null = null;
    const fail = () => live && latest.current.onFail();
    const stopWatching = onAuthFailure(fail);
    loadMaps3d().then((maps) => {
      if (!live || !host.current) return;
      map = new maps.Map3DElement({ ...toCam(opening.current), mode: maps.MapMode.HYBRID, defaultUIHidden: true, gestureHandling: "GREEDY", maxTilt: 80 });
      map.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
      map.addEventListener("gmp-error", fail);
      host.current.append(map);
      setLib({ maps, map });
    }, fail);
    return () => {
      live = false;
      stopWatching();
      map?.remove();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    zoom(by) {
      const map = lib?.map;
      if (map) map.range = Math.min(60_000, Math.max(150, (map.range ?? START.range) * (by > 0 ? 0.6 : 1.6)));
    },
    camera() {
      const map = lib?.map;
      const c = map?.center;
      if (!map || !c) return null;
      return { lat: c.lat, lng: c.lng, alt: 0, range: map.range ?? START.range, tilt: map.tilt ?? START.tilt, heading: map.heading ?? 0 };
    },
  }), [lib]);

  // The day: a line per leg (subway in red, everything else in paper with an ink edge), numbered stops.
  const dayKey = JSON.stringify([stops.map((s) => [s.key, s.number, s.lat, s.lon]), origin && [origin.lat, origin.lon], legs.map((l) => [l.mode, l.coordinates.length, l.coordinates[0]])]);
  useEffect(() => {
    if (!lib) return;
    const { maps, map } = lib;
    const added: HTMLElement[] = [];
    for (const leg of legs) {
      if (leg.coordinates.length < 2) continue;
      const line = new maps.Polyline3DElement({
        path: leg.coordinates.map(([lng, lat]) => ({ lat, lng })),
        strokeColor: leg.mode === "subway" ? RED : PAPER, strokeWidth: 6, outerColor: INK, outerWidth: 0.35,
        altitudeMode: "CLAMP_TO_GROUND", drawsOccludedSegments: true,
      });
      map.append(line);
      added.push(line);
    }
    const pin = (lat: number, lng: number, label: string, title: string, onClick?: () => void) => {
      const m = new maps.Marker3DInteractiveElement({
        position: { lat, lng, altitude: 40 }, altitudeMode: "RELATIVE_TO_GROUND", extruded: true, label,
        drawsWhenOccluded: true, collisionBehavior: "REQUIRED", sizePreserved: true, title,
      });
      if (onClick) m.addEventListener("gmp-click", onClick);
      map.append(m);
      added.push(m);
    };
    if (origin) pin(origin.lat, origin.lon, "Start", origin.label);
    for (const s of stops) pin(s.lat, s.lon, s.number ? String(s.number) : s.name, s.name, () => latest.current.onPickStop(s.key));
    return () => added.forEach((el) => el.remove());
    // `dayKey` stands for stops, origin and legs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, dayKey]);

  // Frame the day whenever its places change (and not while the camera is following playback),
  // but not on opening: 3D opens where the flat map was looking.
  const frameKey = [...stops.map((s) => s.key), origin?.label ?? ""].join("|");
  const following = follow !== null;
  const framed = useRef({ frameKey, following });
  useEffect(() => {
    if (!lib || !host.current) return;
    const was = framed.current;
    framed.current = { frameKey, following };
    if (following || (was.frameKey === frameKey && was.following === following)) return;
    const points = [...stops.map((s) => ({ lat: s.lat, lng: s.lon })), ...(origin ? [{ lat: origin.lat, lng: origin.lon }] : [])];
    const cam = points.length ? fitStops(points, START, host.current.clientWidth, host.current.clientHeight) : START;
    lib.map.stopCameraAnimation();
    lib.map.flyCameraTo({ endCamera: toCam(cam), durationMillis: 1400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, frameKey, following]);

  // Ride along: sit behind the traveler, facing where they're going.
  useEffect(() => {
    if (!lib || !follow) return;
    Object.assign(lib.map, toCam({ lat: follow[1], lng: follow[0], alt: 0, range: 700, tilt: 66, heading: camera.current.bearing }));
  }, [lib, follow, camera]);

  // The traveler: a small marker that moves with playback.
  const travelerRef = useRef<google.maps.maps3d.Marker3DElement | null>(null);
  useEffect(() => {
    if (!lib) return;
    if (!traveler) {
      travelerRef.current?.remove();
      travelerRef.current = null;
      return;
    }
    if (!travelerRef.current) {
      travelerRef.current = new lib.maps.Marker3DElement({ altitudeMode: "RELATIVE_TO_GROUND", extruded: true, drawsWhenOccluded: true, collisionBehavior: "REQUIRED", label: "You" });
      lib.map.append(travelerRef.current);
    }
    travelerRef.current.position = { lat: traveler[1], lng: traveler[0], altitude: 25 };
  }, [lib, traveler]);
  useEffect(() => () => travelerRef.current?.remove(), []);

  return <div ref={host} className="pl-map3d" role="region" aria-label="Your day in 3D" />;
});
