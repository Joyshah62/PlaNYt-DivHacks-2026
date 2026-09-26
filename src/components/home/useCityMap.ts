"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Camera } from "./camera";
import { createCityMap, type CityMap, type MapRole } from "./cityMap";

/**
 * Create a map in `host` once `enabled` turns true; destroy it on unmount. `map` is set
 * after the map has painted. `failed` means no map could be drawn at all.
 */
export function useCityMap(host: RefObject<HTMLElement | null>, initial: Camera, role: MapRole, enabled = true) {
  const [state, setState] = useState<{ map: CityMap | null; failed: boolean }>({ map: null, failed: false });
  useEffect(() => {
    const el = host.current;
    if (!enabled || !el) return;
    let live = true;
    let made: CityMap | null = null;
    const building = new AbortController();
    createCityMap(el, initial, role, building.signal).then(
      (m) => {
        if (!live) return m?.destroy();
        made = m;
        setState({ map: m, failed: !m });
      },
      () => live && setState({ map: null, failed: true }),
    );
    return () => {
      live = false;
      building.abort();
      made?.destroy();
    };
  }, [host, initial, role, enabled]);
  return state;
}
