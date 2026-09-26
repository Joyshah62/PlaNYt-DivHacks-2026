"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { Camera } from "./camera";
import { visibleTimeout, type CityMap } from "./cityMap";

// `beta`, not `alpha`: in alpha every maps3d overlay constructor throws (checked 2026-09-26).
let configured = false;
function configure() {
  if (configured) return;
  configured = true;
  setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "", v: "beta" });
}

// Google reports key/API problems (e.g. ApiNotActivatedMapError) through this global.
let authFailed = false;
const authListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  (window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
    authFailed = true;
    authListeners.forEach((f) => f());
  };
}

const toCam = (c: Camera) => ({
  center: { lat: c.lat, lng: c.lng, altitude: c.alt },
  range: c.range,
  tilt: c.tilt,
  heading: c.heading,
});

export async function createGoogleMap(host: HTMLElement, cam: Camera, signal?: AbortSignal): Promise<CityMap> {
  if (authFailed) throw new Error("Google Maps rejected the key");
  configure();
  const { Map3DElement, MapMode, Polyline3DElement, Marker3DElement } = await importLibrary("maps3d");
  signal?.throwIfAborted(); // don't create (and pay for) a map nobody will see
  const map = new Map3DElement({ ...toCam(cam), mode: MapMode.SATELLITE, defaultUIHidden: true });
  map.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  host.append(map);

  // Ready = first steady frame. Failure = gmp-error or an auth failure. Slow = give up after 8 s of
  // visible time (a hidden tab renders nothing, so waiting there proves nothing).
  await new Promise<void>((resolve, reject) => {
    const finish = (fn: () => void) => {
      cancelTimer();
      map.removeEventListener("gmp-steadychange", onSteady);
      map.removeEventListener("gmp-error", onError);
      authListeners.delete(onError);
      signal?.removeEventListener("abort", onError);
      fn();
    };
    const onSteady = (e: Event) => {
      if ((e as google.maps.maps3d.SteadyChangeEvent).isSteady) finish(resolve);
    };
    const onError = () => finish(() => {
      map.remove();
      reject(new Error("Google 3D map failed to load"));
    });
    const cancelTimer = visibleTimeout(document, 8000, () => finish(resolve));
    map.addEventListener("gmp-steadychange", onSteady);
    map.addEventListener("gmp-error", onError);
    authListeners.add(onError);
    signal?.addEventListener("abort", onError);
  });

  let line: google.maps.maps3d.Polyline3DElement | null = null;
  const pins: HTMLElement[] = [];
  return {
    engine: "google",
    jumpTo(c) {
      map.stopCameraAnimation();
      Object.assign(map, toCam(c));
    },
    flyTo(c, ms) {
      map.stopCameraAnimation();
      return new Promise((resolve) => {
        map.addEventListener("gmp-animationend", () => resolve(), { once: true });
        map.flyCameraTo({ endCamera: toCam(c), durationMillis: ms });
      });
    },
    orbit(c, secondsPerTurn) {
      map.stopCameraAnimation();
      map.flyCameraAround({ camera: toCam(c), durationMillis: secondsPerTurn * 1000, repeatCount: Infinity });
    },
    stop() {
      void map.stopCameraAnimation(); // returns a Promise; callers treat stop() as fire-and-forget
    },
    onMove(cb) {
      const f = () => {
        const c = map.center;
        if (c) cb(c.lat, c.lng, map.heading ?? 0);
      };
      map.addEventListener("gmp-headingchange", f);
      return () => map.removeEventListener("gmp-headingchange", f);
    },
    setRoute(points) {
      if (!line) {
        line = new Polyline3DElement({
          strokeColor: "#c8321f", strokeWidth: 7, outerColor: "#ffffff", outerWidth: 0.5,
          altitudeMode: "CLAMP_TO_GROUND", drawsOccludedSegments: true,
        });
        map.append(line);
      }
      line.path = points.map((p) => ({ lat: p.lat, lng: p.lng })); // a fresh array, or Google may not redraw
    },
    addPin(p, label) {
      const pin = new Marker3DElement({ position: { lat: p.lat, lng: p.lng, altitude: 60 }, altitudeMode: "RELATIVE_TO_GROUND", extruded: true, label });
      map.append(pin);
      pins.push(pin);
    },
    clearOverlays() {
      line?.remove();
      line = null;
      pins.splice(0).forEach((p) => p.remove());
    },
    destroy() {
      map.stopCameraAnimation();
      map.remove();
    },
  };
}
