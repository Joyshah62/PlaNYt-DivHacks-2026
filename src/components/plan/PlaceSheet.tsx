"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock, ExternalLink, ImageOff, Navigation, Plus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ATTRACTION_BY_ID, KIND_LABELS, type OpenWindow, type WeeklyHours } from "@/lib/plan/attractions";
import { crowdBand } from "@/lib/plan/crowd";
import { CROWD_COLOR, CROWD_LABEL, KIND_COLOR } from "@/lib/plan/display";
import { mapsPoint } from "@/lib/plan/maps";
import { clock, duration, WEEKDAYS } from "@/lib/plan/time";
import type { PlannedStop } from "@/lib/plan/types";
import { cn } from "@/lib/utils";
import { CrowdStrip } from "./CrowdStrip";

export interface InspectPlace {
  key: string;
  name: string;
  lat: number;
  lon: number;
  attractionId: string | null;
  visitMin: number;
}

interface PlaceInfo {
  dow: number;
  window: OpenWindow | "always" | null;
  week: WeeklyHours | null;
  crowd: { levels: number[]; station: string; stationMeters: number } | null;
  quietest: { startMin: number; level: number } | null;
}

interface Photo {
  url: string;
  credit: string;
  creditUrl: string | null;
  license: string | null;
  source: "google" | "wikipedia";
}

type Load<T> = { key: string; value: T | null; failed: boolean } | null;

/** Fetch keyed by URL, so switching places never shows the previous place's data. */
function useFetched<T>(url: string): { value: T | null; loading: boolean } {
  const [state, setState] = useState<Load<T>>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (res) => (res.ok ? ((await res.json()) as T) : null))
      .catch(() => null)
      .then((value) => {
        if (!cancelled) setState({ key: url, value, failed: value === null });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  const current = state?.key === url ? state : null;
  return { value: current?.value ?? null, loading: current === null };
}

const mapsSearch = (p: InspectPlace) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, New York, NY`)}`;
/** No origin: Google Maps starts from wherever the reader is now. */
const mapsDirections = (p: InspectPlace) =>
  `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: mapsPoint(p).query, travelmode: "transit" })}`;

function hoursText(w: OpenWindow | "always" | null) {
  if (w === "always") return "Open all day";
  if (w === null) return "Closed";
  return `${clock(w[0])} – ${clock(w[1])}`;
}

/**
 * Everything about one place: a photo, what it is, today's hours, when the area
 * is quiet, where it sits in the plan, and a way to add it or get there.
 */
export function PlaceSheet({
  place,
  date,
  inDay,
  full,
  planned,
  stopNumber,
  onToggle,
  onClose,
}: {
  place: InspectPlace;
  date: string;
  inDay: boolean;
  full: boolean;
  planned: PlannedStop | null;
  stopNumber: number | null;
  onToggle: () => void;
  onClose: () => void;
}) {
  const attraction = place.attractionId ? ATTRACTION_BY_ID.get(place.attractionId) : undefined;
  const where = attraction ? `id=${attraction.id}` : `name=${encodeURIComponent(place.name)}&lat=${place.lat}&lon=${place.lon}`;
  const info = useFetched<PlaceInfo>(`/api/place?${where}&lat=${place.lat}&lon=${place.lon}&date=${date}&visit=${place.visitMin}`);
  const photo = useFetched<Photo>(`/api/photo?${where}`);
  const [imgFailed, setImgFailed] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const weekday = WEEKDAYS[info.value?.dow ?? new Date(`${date}T12:00:00Z`).getUTCDay()];

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [place.key, onClose]);

  const showPhoto = photo.value && imgFailed !== photo.value.url;

  return (
    <>
      {/* Phones get a bottom sheet over a dimmed map; desktop a card floating on the map. */}
      <button type="button" aria-label="Close details" onClick={onClose} className="fixed inset-0 z-40 bg-black/30 lg:hidden" />
      <section
        role="dialog"
        aria-label={place.name}
        className="animate-rise neo-raised-lg fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] overflow-y-auto rounded-t-3xl lg:absolute lg:inset-x-auto lg:top-4 lg:bottom-auto lg:left-4 lg:max-h-[calc(100%-2rem)] lg:w-[min(380px,calc(100vw_-_2rem))] lg:rounded-3xl"
        style={{ "--delay": "0ms" } as React.CSSProperties}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted lg:rounded-t-3xl">
          {photo.loading ? (
            <Skeleton className="size-full rounded-none" />
          ) : showPhoto ? (
            // Remote, per-place images from Google or Wikimedia; next/image would need every host allow-listed.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.value!.url} alt={`${place.name}`} className="size-full object-cover" onError={() => setImgFailed(photo.value!.url)} referrerPolicy="no-referrer" />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              <span className="flex flex-col items-center gap-2 text-xs">
                <ImageOff className="size-6" aria-hidden /> No photo available
              </span>
            </div>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-background/85 text-foreground shadow backdrop-blur transition hover:bg-background"
          >
            <X className="size-4" aria-hidden />
          </button>
          {stopNumber !== null && (
            <span className="absolute top-3 left-3 grid size-9 place-items-center rounded-full bg-foreground text-sm font-semibold text-background shadow">
              {stopNumber}
            </span>
          )}
        </div>
        {showPhoto && (
          <p className="truncate px-5 pt-2 text-[10px] text-muted-foreground">
            Photo:{" "}
            {photo.value!.creditUrl ? (
              <a href={photo.value!.creditUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                {photo.value!.credit}
              </a>
            ) : (
              photo.value!.credit
            )}
            {photo.value!.license && ` · ${photo.value!.license}`}
            {photo.value!.source === "google" ? " · Google Maps" : " · Wikimedia Commons"}
          </p>
        )}

        <div className="space-y-5 p-5 pt-3">
          <div>
            {attraction && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: KIND_COLOR[attraction.kind] }} aria-hidden />
                {KIND_LABELS[attraction.kind].replace(/s$/, "")} · {attraction.area}
              </p>
            )}
            <h2 className="mt-1 font-display text-3xl leading-tight tracking-tight">{place.name}</h2>
            {attraction && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{attraction.blurb}</p>}
          </div>

          {planned && (
            <div className="rounded-2xl bg-brand-soft px-4 py-3 text-sm">
              <p className="font-medium">
                Stop {stopNumber}: {clock(planned.startMin)} – {clock(planned.endMin)}
              </p>
              <p className="text-muted-foreground">
                {duration(planned.visitMin)} here
                {planned.crowd && (
                  <>
                    {" · "}
                    <span style={{ color: CROWD_COLOR[planned.crowd.band] }}>{CROWD_LABEL[planned.crowd.band].toLowerCase()}</span> then
                  </>
                )}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={onToggle}
              disabled={!inDay && full}
              className={cn(
                "h-10 flex-1 rounded-full text-sm font-semibold",
                inDay ? "neo-control neo-inset text-brand" : "neo-primary",
              )}
            >
              {inDay ? <Check aria-hidden /> : <Plus aria-hidden />}
              {inDay ? "In your day · remove" : full ? "Day is full" : "Add to my day"}
            </Button>
            <a
              href={mapsDirections(place)}
              target="_blank"
              rel="noreferrer"
              className="neo-control inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition"
            >
              <Navigation className="size-4" aria-hidden /> Directions
            </a>
          </div>

          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Clock className="size-3.5" aria-hidden /> {weekday}
            </h3>
            {info.loading ? (
              <Skeleton className="mt-2 h-5 w-40" />
            ) : info.value ? (
              <p className={cn("mt-1 text-sm", info.value.window === null && "font-medium text-sev-c")}>
                {info.value.window === null ? `Usually closed on ${weekday}s` : hoursText(info.value.window)}
                {!attraction && info.value.window === "always" && <span className="text-muted-foreground"> (hours not known; check before you go)</span>}
              </p>
            ) : null}
            {info.value?.week && (
              <details className="mt-1 text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none hover:text-foreground">Typical weekly hours</summary>
                <ul className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                  {info.value.week.map((w, d) => (
                    <li key={d} className={cn("contents", d === info.value!.dow && "font-medium text-foreground")}>
                      <span>{WEEKDAYS[d].slice(0, 3)}</span>
                      <span className="tabular-nums">{hoursText(w)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {info.value?.crowd && (
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <Users className="size-3.5" aria-hidden /> Crowds nearby, typical {weekday}
              </h3>
              <CrowdStrip
                className="mt-2"
                levels={info.value.crowd.levels}
                visitStart={planned?.startMin ?? info.value.quietest?.startMin ?? 0}
                visitEnd={planned?.endMin ?? (info.value.quietest ? info.value.quietest.startMin + place.visitMin : 0)}
                fromHour={7}
                toHour={23}
              />
              <p className="mt-2 text-sm">
                {planned && (
                  <span className="block text-muted-foreground">
                    Lit up: your visit, {clock(planned.startMin)} – {clock(planned.endMin)}.
                  </span>
                )}
                {info.value.quietest && (
                  <>
                    Quietest while open:{" "}
                    <span className="font-medium" style={{ color: CROWD_COLOR[crowdBand(info.value.quietest.level)] }}>
                      around {clock(info.value.quietest.startMin)}
                    </span>
                  </>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">From subway ridership around {info.value.crowd.station}. Street busyness, not the line inside.</p>
            </div>
          )}

          <a href={mapsSearch(place)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand underline-offset-4 hover:underline">
            Reviews, photos and more on Google Maps <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </section>
    </>
  );
}
