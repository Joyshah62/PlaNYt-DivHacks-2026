"use client";

import { useRef } from "react";
import type { Camera } from "@/components/home/camera";
import { useCityMap } from "@/components/home/useCityMap";
import { useInView } from "@/components/home/visibility";

// Face to face with Liberty: she looks south-east, out to the Narrows, so the camera stands
// off her face and looks back north-west, level with her head (~80 m up). It holds still: an
// orbit would turn her away.
const LIBERTY: Camera = { lat: 40.6892, lng: -74.0445, alt: 75, range: 280, tilt: 84, heading: 315 };

/**
 * The sign-in page's plate: the Statue of Liberty on whichever engine is set (Google 3D, or
 * MapLibre). Built only once it's on screen, so phones (where the plate is hidden) never load a map.
 */
export function LoginMap() {
  const host = useRef<HTMLDivElement>(null);
  const shown = useInView(host, { once: true });
  useCityMap(host, LIBERTY, "secondary", shown);
  return <div ref={host} className="au-map" aria-hidden />;
}
