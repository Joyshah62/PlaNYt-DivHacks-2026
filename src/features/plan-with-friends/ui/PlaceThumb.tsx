"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { APP_API, type StopInput } from "../bridge/index";

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

  return (
    <span title={loaded ? `Photo: ${loaded.credit}` : undefined} className={className ? `tr-thumb ${className}` : "tr-thumb"}>
      {loaded ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={loaded.url} alt="" aria-hidden loading="lazy" />
      ) : (
        <span aria-hidden className="tr-thumb-empty">
          <MapPin />
        </span>
      )}
    </span>
  );
}
