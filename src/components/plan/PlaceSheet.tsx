"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock, ImageOff, Navigation, Plus, Users, X } from "lucide-react";
import { ATTRACTION_BY_ID, KIND_LABELS, type OpenWindow, type WeeklyHours } from "@/lib/plan/attractions";
import { CROWD_LABEL } from "@/lib/plan/display";
import { mapsPoint } from "@/lib/plan/maps";
import { clock, duration, WEEKDAYS } from "@/lib/plan/time";
import type { PlannedStop } from "@/lib/plan/types";
import { CrowdStrip } from "./CrowdStrip";
import { useFocusTrap } from "./useFocusTrap";

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
  const sheetRef = useRef<HTMLElement>(null);
  // On a phone the sheet covers the map and is modal; on a desktop it's a card beside the column.
  const [modal] = useState(() => window.matchMedia("(max-width: 1023px)").matches);
  useFocusTrap(sheetRef, modal);
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
      {/* Phones get a bottom sheet over a dimmed map; desktop a card on the map's corner. */}
      <div aria-hidden onClick={onClose} className="pl-scrim place" />
      <section ref={sheetRef} role="dialog" aria-modal={modal} aria-label={place.name} className="pl-sheet place">
        <div className="pl-photo">
          {photo.loading ? (
            <div className="pl-skeleton size-full" />
          ) : showPhoto ? (
            // Remote, per-place images from Google or Wikimedia; next/image would need every host allow-listed.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.value!.url} alt={place.name} onError={() => setImgFailed(photo.value!.url)} referrerPolicy="no-referrer" />
          ) : (
            <span className="pl-photo-empty">
              <ImageOff aria-hidden />
            </span>
          )}
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close details" className="pl-sheet-close">
            <X aria-hidden />
          </button>
          {stopNumber !== null && <span className="pl-bullet pl-sheet-num">{stopNumber}</span>}
        </div>
        {showPhoto && (
          <p className="pl-credit">
            Photo:{" "}
            {photo.value!.creditUrl ? (
              <a href={photo.value!.creditUrl} target="_blank" rel="noreferrer" className="pl-link">
                {photo.value!.credit}
              </a>
            ) : (
              photo.value!.credit
            )}
            {photo.value!.license && ` · ${photo.value!.license}`}
            {photo.value!.source === "google" ? " · Google Maps" : " · Wikimedia Commons"}
          </p>
        )}

        <div className="pl-sheet-pad">
          <div>
            {attraction && (
              <p className="pl-mono pl-kicker">
                {KIND_LABELS[attraction.kind].replace(/s$/, "")} · {attraction.area}
              </p>
            )}
            <h2 className="pl-h2">{place.name}</h2>
            {attraction && <p className="pl-dek">{attraction.blurb}</p>}
          </div>

          {planned && (
            <p className="pl-note">
              <span className="pl-mono">
                Stop {stopNumber} · {clock(planned.startMin)} – {clock(planned.endMin)}
              </span>
              <br />
              {duration(planned.visitMin)} here
              {planned.crowd && <>, {CROWD_LABEL[planned.crowd.band].toLowerCase()} then</>}
            </p>
          )}

          <div className="pl-sheet-buttons">
            <button type="button" onClick={onToggle} disabled={!inDay && full} className={inDay ? "ed-btn ed-btn--ghost" : "ed-btn"}>
              {inDay ? <Check aria-hidden /> : <Plus aria-hidden />}
              {inDay ? "In your day · remove" : full ? "Day is full" : "Add to my day"}
            </button>
            <a href={mapsDirections(place)} target="_blank" rel="noreferrer" className="ed-btn ed-btn--ghost">
              <Navigation aria-hidden /> Directions
            </a>
          </div>

          <div>
            <h3 className="pl-mono pl-muted flex items-center gap-1.5">
              <Clock className="size-[1.1em]" aria-hidden /> {weekday}
            </h3>
            {info.loading ? (
              <div className="pl-skeleton mt-2 h-5 w-40" />
            ) : info.value ? (
              <p className={info.value.window === null ? "pl-flag mt-1" : "pl-small mt-1"}>
                {info.value.window === null ? `Usually closed on ${weekday}s` : hoursText(info.value.window)}
                {!attraction && info.value.window === "always" && <span className="pl-muted"> (hours not known; check before you go)</span>}
              </p>
            ) : null}
            {info.value?.week && (
              <details className="mt-1 pl-small pl-muted">
                <summary className="cursor-pointer select-none hover:text-(--ink)">Typical weekly hours</summary>
                <ul className="pl-hours">
                  {info.value.week.map((w, d) => (
                    <li key={d} className={d === info.value!.dow ? "contents today" : "contents"}>
                      <span className={d === info.value!.dow ? "today" : undefined}>{WEEKDAYS[d].slice(0, 3)}</span>
                      <span className={d === info.value!.dow ? "today" : undefined}>{hoursText(w)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {info.value?.crowd && (
            <div>
              <h3 className="pl-mono pl-muted flex items-center gap-1.5">
                <Users className="size-[1.1em]" aria-hidden /> Crowds nearby, typical {weekday}
              </h3>
              <CrowdStrip
                className="mt-2"
                levels={info.value.crowd.levels}
                visitStart={planned?.startMin ?? info.value.quietest?.startMin ?? 0}
                visitEnd={planned?.endMin ?? (info.value.quietest ? info.value.quietest.startMin + place.visitMin : 0)}
                fromHour={7}
                toHour={23}
              />
              <p className="pl-small mt-2">
                {planned ? `In red: your visit, ${clock(planned.startMin)} – ${clock(planned.endMin)}. ` : ""}
                {info.value.quietest && (
                  <>
                    Quietest while open: <span className="pl-red">around {clock(info.value.quietest.startMin)}</span>.
                  </>
                )}
              </p>
              <p className="pl-small pl-muted mt-1">From subway ridership around {info.value.crowd.station}. Street busyness, not the line inside.</p>
            </div>
          )}

          <a href={mapsSearch(place)} target="_blank" rel="noreferrer" className="pl-link pl-small">
            Reviews, photos and more on Google Maps ↗
          </a>
        </div>
      </section>
    </>
  );
}
