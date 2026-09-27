"use client";

import { useEffect, useRef } from "react";
import type { Camera } from "@/components/home/camera";
import { ORBIT_SECONDS } from "@/components/home/data";
import { useCityMap } from "@/components/home/useCityMap";
import { useInView, usePageVisible, usePrefersReducedMotion } from "@/components/home/visibility";

const LOWER_MANHATTAN: Camera = { lat: 40.728, lng: -73.992, alt: 0, range: 2600, tilt: 60, heading: -28 };

/**
 * The sign-in page's plate: the home page's city on whichever engine is set (Google 3D, or
 * MapLibre), slowly orbiting. Built only once it's on screen, so phones (where the plate is
 * hidden) never load a map.
 */
export function LoginMap() {
  const host = useRef<HTMLDivElement>(null);
  const shown = useInView(host, { once: true });
  const pageVisible = usePageVisible();
  const reduced = usePrefersReducedMotion();
  const { map } = useCityMap(host, LOWER_MANHATTAN, "secondary", shown);

  useEffect(() => {
    if (!map) return;
    if (pageVisible && !reduced) map.orbit(LOWER_MANHATTAN, ORBIT_SECONDS);
    else map.stop();
  }, [map, pageVisible, reduced]);

  return <div ref={host} className="au-map" aria-hidden />;
}
