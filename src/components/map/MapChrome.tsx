"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Box,
  Car,
  Clock,
  Crosshair,
  Flame,
  Footprints,
  Globe,
  Layers,
  Loader2,
  MapPin,
  Phone,
  Route,
  Waves,
  X,
} from "lucide-react";
import { categoryLabel, CUISINE_LABELS } from "@/lib/osm/categories";
import type { CategoryId, CommuteRow, Place, RouteResult } from "@/lib/osm/types";
import { CATEGORY_ICONS, DESTINATION_ICONS, categoryStyle } from "@/components/neighborhood/meta";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

const glass = "bg-card/92 backdrop-blur-xl shadow-[0_2px_12px_-2px_oklch(0_0_0/0.18)] ring-1 ring-foreground/8";

// ---------------------------------------------------------------------------

export interface ChipOption {
  id: CategoryId;
  count: number;
}

/** Category filter that lives on the map itself. */
export function CategoryChips({
  options,
  active,
  onChange,
}: {
  options: ChipOption[];
  active: CategoryId | null;
  onChange: (id: CategoryId | null) => void;
}) {
  return (
    <div className="pointer-events-auto flex gap-1.5 overflow-x-auto p-1 [scrollbar-width:none]" role="toolbar" aria-label="Show on map">
      <button
        type="button"
        aria-pressed={active === null}
        onClick={() => onChange(null)}
        className={cn(
          "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
          active === null ? "bg-foreground text-background" : cn(glass, "hover:bg-card"),
        )}
      >
        Everything
      </button>
      {options.map(({ id, count }) => {
        const Icon = CATEGORY_ICONS[id];
        const on = active === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : id)}
            style={categoryStyle(id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pr-3 pl-2 text-xs font-medium transition",
              on ? "bg-(--c) text-on-color" : cn(glass, "hover:bg-card"),
            )}
          >
            <Icon className={cn("size-3.5", on ? "text-on-color" : "text-(--c)")} aria-hidden />
            {categoryLabel(id)}
            <span className={cn("tabular-nums", on ? "text-on-color/80" : "text-muted-foreground")}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface LayerState {
  zones: boolean;
  buildings3d: boolean;
  heatmap: boolean;
}

/** Map controls: recenter, 3D and a layers menu. */
export function MapControls({
  layers,
  onLayers,
  onRecenter,
  zonesExact,
}: {
  layers: LayerState;
  onLayers: (next: LayerState) => void;
  onRecenter: () => void;
  /** Walk zones follow real streets (true) or are a circle fallback. */
  zonesExact: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const btn = cn(glass, "grid size-10 place-items-center rounded-xl text-foreground transition hover:bg-card active:scale-95");

  const rows: { key: keyof LayerState; icon: typeof Waves; title: string; body: string }[] = [
    { key: "zones", icon: Waves, title: "Walking zones", body: zonesExact ? "5, 10 and 15 minutes on real streets" : "Approximate 5, 10 and 15 minute circles" },
    { key: "heatmap", icon: Flame, title: "Activity heatmap", body: "Where shops, food and services cluster" },
    { key: "buildings3d", icon: Box, title: "3D buildings", body: "Tilt the city to see building heights" },
  ];

  return (
    <div className="pointer-events-auto flex flex-col gap-2" ref={menuRef}>
      <button type="button" onClick={onRecenter} className={btn} aria-label="Recenter on the apartment" title="Recenter">
        <Crosshair className="size-[18px]" aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={layers.buildings3d}
        onClick={() => onLayers({ ...layers, buildings3d: !layers.buildings3d })}
        className={cn(btn, "text-xs font-bold", layers.buildings3d && "bg-foreground! text-background")}
        title="3D buildings"
      >
        3D
      </button>
      <div className="relative">
        <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)} className={cn(btn, open && "bg-foreground! text-background")} aria-label="Map layers" title="Layers">
          <Layers className="size-[18px]" aria-hidden />
        </button>
        {open && (
          <div className={cn(glass, "animate-rise absolute top-0 right-12 w-72 rounded-2xl p-2")} role="menu" aria-label="Map layers">
            {rows.map(({ key, icon: Icon, title, body }) => (
              <button
                key={key}
                type="button"
                role="menuitemcheckbox"
                aria-checked={layers[key]}
                onClick={() => onLayers({ ...layers, [key]: !layers[key] })}
                className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-muted"
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition", layers[key] ? "bg-brand text-on-color" : "bg-muted text-muted-foreground")}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="block text-xs leading-snug text-muted-foreground">{body}</span>
                </span>
                <span aria-hidden className={cn("mt-2 h-5 w-9 shrink-0 rounded-full p-0.5 transition", layers[key] ? "bg-brand" : "bg-border")}>
                  <span className={cn("block size-4 rounded-full bg-white shadow transition", layers[key] && "translate-x-4")} />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ZoneLegend({ exact }: { exact: boolean }) {
  return (
    <div className={cn(glass, "pointer-events-auto inline-flex items-center gap-3 rounded-full px-3.5 py-2 text-[11px] font-medium")}>
      <span className="flex items-center gap-1.5">
        {[0.34, 0.22, 0.12].map((o, i) => (
          <span key={i} className="size-2.5 rounded-full bg-brand" style={{ opacity: o * 2 }} />
        ))}
      </span>
      <span className="text-muted-foreground">
        5 · 10 · 15 min walk{exact ? "" : " (approx.)"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------

function osmUrl(id: string) {
  return `https://www.openstreetmap.org/${id}`;
}

/** Details for a tapped place, with its routed walk. */
export function PlaceCard({
  place,
  route,
  routeLoading,
  onClose,
}: {
  place: Place;
  route: RouteResult | null;
  routeLoading: boolean;
  onClose: () => void;
}) {
  const Icon = CATEGORY_ICONS[place.category];
  const minutes = route?.minutes ?? place.walkMin;
  const meters = route?.meters ?? place.meters;
  return (
    <div
      className={cn(glass, "animate-rise pointer-events-auto w-full max-w-sm rounded-2xl p-4 sm:p-5")}
      style={categoryStyle(place.category)}
      role="dialog"
      aria-label={place.name}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--c) text-on-color">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-(--c)">
            {categoryLabel(place.category)}
            {place.cuisine && ` · ${CUISINE_LABELS[place.cuisine] ?? place.cuisine}`}
          </p>
          <h3 className="font-display text-2xl leading-tight">{place.name}</h3>
          {place.street && <p className="truncate text-xs text-muted-foreground">{place.street}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-4 rounded-xl bg-muted/70 px-4 py-3">
        <Footprints className="size-5 text-(--c)" aria-hidden />
        <p className="flex items-baseline gap-1">
          <span className="font-display text-3xl leading-none tabular-nums">
            {!route && place.estimated ? "~" : ""}
            {minutes}
          </span>
          <span className="text-sm text-muted-foreground">min walk</span>
        </p>
        <p className="ml-auto text-sm text-muted-foreground tabular-nums">
          {meters >= 1000 ? `${(meters / 1609.344).toFixed(1)} mi` : `${Math.round(meters)} m`}
        </p>
        {routeLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading route" />}
      </div>

      {(place.hours || place.phone || place.website) && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {place.hours && (
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="break-words">{place.hours}</span>
            </li>
          )}
          {place.phone && (
            <li className="flex items-center gap-2.5">
              <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <a href={`tel:${place.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                {place.phone}
              </a>
            </li>
          )}
          {place.website && (
            <li className="flex items-center gap-2.5">
              <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <a href={place.website} target="_blank" rel="noreferrer noopener" className="truncate text-brand hover:underline">
                {place.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            </li>
          )}
        </ul>
      )}

      <a
        href={osmUrl(place.id)}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        View on OpenStreetMap <ArrowUpRight className="size-3" aria-hidden />
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** A commute destination with its drawn route and a mode switch. */
export function DestinationCard({
  row,
  mode,
  onMode,
  route,
  routeLoading,
  routeFailed,
  origin,
  onClose,
}: {
  row: CommuteRow;
  mode: "foot" | "car";
  onMode: (m: "foot" | "car") => void;
  route: RouteResult | null;
  routeLoading: boolean;
  routeFailed: boolean;
  origin: { lat: number; lon: number };
  onClose: () => void;
}) {
  const Icon = DESTINATION_ICONS[row.kind];
  const walkable = row.walkMin !== null && row.walkMin <= 60;
  const minutes = route?.minutes ?? (mode === "car" ? row.driveMin : row.walkMin);
  const miles = route ? route.meters / 1609.344 : mode === "car" ? row.driveMiles : null;
  const transit = `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lon}`,
    destination: `${row.lat},${row.lon}`,
    travelmode: "transit",
  })}`;

  return (
    <div className={cn(glass, "animate-rise pointer-events-auto w-full max-w-sm rounded-2xl p-4 sm:p-5")} role="dialog" aria-label={`Route to ${row.label}`}>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", row.kind === "preset" ? "bg-foreground text-background" : "bg-brand text-on-color")}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{row.kind === "preset" ? "Popular destination" : `Your ${row.kind === "other" ? "place" : row.kind}`}</p>
          <h3 className="font-display text-2xl leading-tight">{row.label}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Segmented
          label="Travel mode"
          value={mode}
          onChange={onMode}
          options={[
            { value: "car", label: <><Car className="size-3.5" aria-hidden /> Drive</> },
            ...(walkable ? [{ value: "foot" as const, label: <><Footprints className="size-3.5" aria-hidden /> Walk</> }] : []),
          ]}
        />
        {routeLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading route" />}
      </div>

      <div className="mt-3 flex items-baseline gap-2 rounded-xl bg-muted/70 px-4 py-3">
        <Route className="size-5 self-center text-brand" aria-hidden />
        <span className="font-display text-3xl leading-none tabular-nums">{minutes ?? "—"}</span>
        <span className="text-sm text-muted-foreground">min {mode === "car" ? "drive" : "walk"}</span>
        {miles !== null && <span className="ml-auto text-sm text-muted-foreground tabular-nums">{miles.toFixed(1)} mi</span>}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {routeFailed ? "Couldn't draw the route right now. The time is still an estimate." : mode === "car" ? "No-traffic estimate on OpenStreetMap roads." : "Walking estimate on OpenStreetMap paths."}
      </p>

      <a href={transit} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:border-foreground/30">
        <MapPin className="size-3.5" aria-hidden /> Check subway & bus on Google Maps <ArrowUpRight className="size-3" aria-hidden />
      </a>
    </div>
  );
}
