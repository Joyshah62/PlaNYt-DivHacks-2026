"use client";

import { useEffect, useState } from "react";
import { APP_API, type StopInput } from "../bridge/index";
import { cn } from "../bridge/ui";

interface Photo {
  url: string;
  credit: string;
}

// Shared across every thumbnail on the page so a place is fetched once, however often it appears.
const cache = new Map<string, Promise<Photo | null>>();

function photoFor(stop: Pick<StopInput, "key" | "name" | "lat" | "lon" | "attractionId">): Promise<Photo | null> {
  let hit = cache.get(stop.key);
  if (!hit) {
    const query = stop.attractionId
      ? `id=${encodeURIComponent(stop.attractionId)}`
      : `name=${encodeURIComponent(stop.name)}&lat=${stop.lat}&lon=${stop.lon}`;
    hit = fetch(`${APP_API.photo}?${query}`)
      .then((res) => (res.ok ? (res.json() as Promise<Photo>) : null))
      .catch(() => null);
    cache.set(stop.key, hit);
  }
  return hit;
}

const TINTS = ["from-sky-500/40 to-indigo-500/30", "from-amber-500/40 to-rose-500/30", "from-emerald-500/40 to-teal-500/30", "from-fuchsia-500/40 to-violet-500/30"];

export function PlaceThumb({ stop, className }: { stop: Pick<StopInput, "key" | "name" | "lat" | "lon" | "attractionId">; className?: string }) {
  const [photo, setPhoto] = useState<{ key: string; value: Photo | null } | null>(null);
  const loaded = photo?.key === stop.key ? photo.value : undefined;

  const { key, name, lat, lon, attractionId } = stop;
  useEffect(() => {
    let live = true;
    photoFor({ key, name, lat, lon, attractionId }).then((value) => live && setPhoto({ key, value }));
    return () => {
      live = false;
    };
  }, [key, name, lat, lon, attractionId]);

  const tint = TINTS[[...stop.key].reduce((h, c) => h + c.charCodeAt(0), 0) % TINTS.length];
  return (
    <span title={loaded ? `Photo: ${loaded.credit}` : undefined} className={cn("relative block shrink-0 overflow-hidden rounded-xl bg-gradient-to-br", tint, className)}>
      {loaded ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={loaded.url} alt="" aria-hidden loading="lazy" className="size-full object-cover" />
      ) : (
        <span aria-hidden className={cn("grid size-full place-items-center text-sm font-semibold text-white/80", loaded === undefined && "animate-pulse")}>
          {stop.name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
