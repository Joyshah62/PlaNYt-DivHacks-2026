"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, History, Loader2, MapPin, Pencil, Plus } from "lucide-react";
import {
  MAX_DESTINATIONS,
  PREFERENCES,
  decodePreferences,
  encodePreferences,
  lifestyleHighlights,
  preferenceDef,
  type CustomDestination,
  type PreferenceId,
  type Preferences,
} from "@/lib/preferences";
import type { LatLon, NearbyReport } from "@/lib/osm/types";
import { useJson } from "@/lib/useJson";
import { cn } from "@/lib/utils";
import { PREFERENCE_ICONS, categoryStyle } from "@/components/neighborhood/meta";
import { CityMapLazy } from "@/components/map/LazyMaps";
import { NO_HIGHLIGHT, type MapFrame, type MapHighlight } from "@/components/map/mapTypes";
import { Skeleton } from "@/components/ui/skeleton";
import { DestinationInput } from "./DestinationInput";

const GROUPS: { title: string; ids: PreferenceId[] }[] = [
  { title: "Getting around", ids: ["commute", "transit"] },
  { title: "Everyday errands", ids: ["groceries", "pharmacy", "laundry", "coffee"] },
  { title: "Food", ids: ["restaurants", "indian", "asian", "italian"] },
  { title: "Lifestyle", ids: ["fitness", "parks", "nightlife", "quiet", "entertainment"] },
];

const ALL_IDS = PREFERENCES.map((p) => p.id);
const STORAGE_KEY = "rentcheck:preferences";

function readSaved(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function save(prefs: Preferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, encodePreferences(prefs).toString());
  } catch {
    /* private mode: the URL still carries everything */
  }
}

const noSubscribe = () => () => {};

interface Row extends CustomDestination {
  key: number;
}

/**
 * Step two. The neighborhood loads while the reader chooses, so every priority
 * shows its real count for this address, the map previews it, and the report
 * that follows opens from a warm cache.
 */
export function PreferencesForm({ address, initial }: { address: string; initial: Preferences }) {
  const router = useRouter();
  const [selected, setSelected] = useState<PreferenceId[]>(initial.prefs);
  const [rows, setRows] = useState<Row[]>(() => initial.destinations.map((d, i) => ({ ...d, key: i })));
  const [nextKey, setNextKey] = useState(initial.destinations.length);
  const [submitting, setSubmitting] = useState(false);

  const locate = useJson<{ label: string; location: LatLon | null }>(`/api/locate?address=${encodeURIComponent(address)}`);
  const center = locate.data?.location ?? null;
  const at = center ? `lat=${center.lat}&lon=${center.lon}` : null;
  const nearby = useJson<NearbyReport>(at && `/api/nearby?${at}`);
  const zones = useJson<GeoJSON.FeatureCollection>(at && `/api/isochrone?${at}`);
  const nearbyOk = nearby.data?.placesStatus.ok ? nearby.data : null;

  // One fact per priority, for the badges and the preview.
  const facts = useMemo(() => lifestyleHighlights(ALL_IDS, nearbyOk, null), [nearbyOk]);

  const highlight: MapHighlight = useMemo(() => {
    const ids = new Set(facts.filter((f) => selected.includes(f.pref)).flatMap((f) => f.placeIds));
    return ids.size ? { categories: null, cuisine: null, ids: [...ids] } : NO_HIGHLIGHT;
  }, [facts, selected]);

  const frame: MapFrame = useMemo(() => {
    if (!center) return { key: "none", points: [] };
    const d = 0.0085;
    const dl = d / Math.cos((center.lat * Math.PI) / 180);
    return { key: "home", points: [[center.lon - dl, center.lat - d], [center.lon + dl, center.lat + d]] };
  }, [center]);

  // Last visit's choices, offered - never silently applied.
  const savedRaw = useSyncExternalStore(noSubscribe, readSaved, () => null);
  const saved = savedRaw ? decodePreferences(Object.fromEntries(new URLSearchParams(savedRaw))) : null;
  const canRestore = saved !== null && saved.prefs.length + saved.destinations.length > 0 && selected.length === 0 && rows.length === 0;

  function toggle(id: PreferenceId) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function addRow() {
    const kind = rows.some((r) => r.kind === "work") ? (rows.some((r) => r.kind === "school") ? "other" : "school") : "work";
    setRows((r) => [...r, { key: nextKey, kind, text: "" }]);
    setNextKey((k) => k + 1);
  }

  function restore() {
    if (!saved) return;
    setSelected(saved.prefs);
    setRows(saved.destinations.map((d, i) => ({ ...d, key: nextKey + i })));
    setNextKey((k) => k + saved.destinations.length);
  }

  function go(skip: boolean) {
    const prefs: Preferences = skip
      ? { prefs: [], destinations: [] }
      : { prefs: selected, destinations: rows.filter((r) => r.text.trim().length >= 2).map(({ kind, text }) => ({ kind, text })) };
    if (!skip) save(prefs);
    const params = encodePreferences(prefs);
    params.set("address", address);
    setSubmitting(true);
    router.push(`/report?${params}`);
  }

  const destinationsFilled = rows.filter((r) => r.text.trim().length >= 2).length;
  const matched = highlight.ids?.length ?? 0;

  function badge(id: PreferenceId): string | null {
    if (id === "commute") return null;
    const f = facts.find((x) => x.pref === id);
    if (!f || f.value === null) return null;
    if (f.unit === "minutes") return `${f.value} min`;
    return id === "quiet" ? `${f.value} bars close by` : `${f.value} nearby`;
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,44%)]">
      <div className="flex min-w-0 flex-col">
        <div className="mx-auto w-full max-w-2xl flex-1 px-5 pt-10 pb-12 sm:px-8 sm:pt-14">
          <ol className="flex items-center gap-2 text-xs font-medium text-muted-foreground" aria-label="Progress">
            <li className="flex items-center gap-1.5 text-foreground">
              <span className="grid size-5 place-items-center rounded-full bg-foreground text-background">
                <Check className="size-3" aria-hidden />
              </span>
              Address
            </li>
            <li aria-hidden className="h-px w-6 bg-border" />
            <li className="flex items-center gap-1.5 text-foreground" aria-current="step">
              <span className="grid size-5 place-items-center rounded-full border-2 border-foreground text-[10px]">2</span>
              Your priorities
            </li>
            <li aria-hidden className="h-px w-6 bg-border" />
            <li className="flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded-full border border-border text-[10px]">3</span>
              Report
            </li>
          </ol>

          <div className="mt-8 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4 text-brand" aria-hidden />
            <span className="font-medium text-foreground">{locate.data?.label ?? address}</span>
            <Link href="/" className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs hover:bg-muted hover:text-foreground">
              <Pencil className="size-3" aria-hidden /> Change
            </Link>
          </div>

          <h1 className="mt-3 font-display text-5xl leading-[1] tracking-tight text-balance sm:text-6xl">What matters to you?</h1>
          <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
            Pick anything that shapes your day. The numbers are real, for this address, from OpenStreetMap.
          </p>

          {canRestore && (
            <button
              type="button"
              onClick={restore}
              className="animate-rise mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:border-foreground/25"
            >
              <History className="size-4 text-brand" aria-hidden />
              Use my last priorities
              <span className="font-normal text-muted-foreground">
                {saved!.prefs.length > 0
                  ? `(${saved!.prefs.slice(0, 3).map((id) => preferenceDef(id).label).join(", ")}${saved!.prefs.length > 3 ? ` +${saved!.prefs.length - 3}` : ""})`
                  : `(${saved!.destinations.length} destinations)`}
              </span>
            </button>
          )}

          <div className="mt-10 space-y-8">
            {GROUPS.map((group, g) => (
              <fieldset key={group.title} className="animate-rise" style={{ "--delay": `${g * 60}ms` } as React.CSSProperties}>
                <legend className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{group.title}</legend>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {group.ids.map((id) => {
                    const def = PREFERENCES.find((p) => p.id === id)!;
                    const Icon = PREFERENCE_ICONS[id];
                    const on = selected.includes(id);
                    const b = badge(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(id)}
                        style={categoryStyle(def.category)}
                        className={cn(
                          "group relative flex min-h-[92px] flex-col items-start justify-between gap-3 rounded-2xl border p-3.5 text-left transition duration-200 active:scale-[0.97]",
                          on ? "border-foreground bg-foreground text-background shadow-lg shadow-foreground/15" : "border-border bg-card hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md",
                        )}
                      >
                        <span className={cn("grid size-8 place-items-center rounded-lg transition", on ? "bg-(--c) text-on-color" : "bg-(--c)/12 text-(--c)")}>
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span>
                          <span className="block text-sm leading-tight font-medium">{def.label}</span>
                          <span className={cn("mt-0.5 block text-xs tabular-nums", on ? "text-background/70" : "text-muted-foreground")}>
                            {nearby.status === "loading" && id !== "commute" ? <span className="mt-1 block h-3 w-14 animate-pulse rounded bg-current/15" /> : (b ?? (id === "commute" ? "Add places below" : " "))}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className={cn(
                            "absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-background text-foreground transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                            on ? "scale-100 opacity-100" : "scale-50 opacity-0",
                          )}
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <section className="mt-14" aria-labelledby="dest-title">
            <h2 id="dest-title" className="font-display text-3xl tracking-tight">Where do you go often?</h2>
            <p className="mt-2 text-[15px] text-muted-foreground">Work, school, anywhere you travel to regularly. We&apos;ll draw the route from this address.</p>
            <div className="mt-5 space-y-3">
              {rows.map((row, i) => (
                <DestinationInput
                  key={row.key}
                  value={row}
                  autoFocus={i === rows.length - 1 && row.text === ""}
                  onChange={(next) => setRows((r) => r.map((x) => (x.key === row.key ? { ...x, ...next } : x)))}
                  onRemove={() => setRows((r) => r.filter((x) => x.key !== row.key))}
                />
              ))}
              {rows.length < MAX_DESTINATIONS && (
                <button
                  type="button"
                  onClick={addRow}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-4 text-sm font-medium text-muted-foreground transition hover:border-brand hover:bg-brand-soft/50 hover:text-brand"
                >
                  <Plus className="size-4" aria-hidden />
                  {rows.length === 0 ? "Add a place you travel to" : "Add another"}
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 z-30 border-t border-border bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3.5 sm:px-8">
            <p className="hidden text-sm text-muted-foreground sm:block" aria-live="polite">
              {selected.length === 0 && destinationsFilled === 0 ? (
                "Nothing picked yet: you'll get the full report."
              ) : (
                <>
                  <span className="font-semibold text-foreground tabular-nums">{selected.length}</span> {selected.length === 1 ? "priority" : "priorities"}
                  {destinationsFilled > 0 && (
                    <>
                      {" · "}
                      <span className="font-semibold text-foreground tabular-nums">{destinationsFilled}</span> {destinationsFilled === 1 ? "place" : "places"}
                    </>
                  )}
                </>
              )}
            </p>
            <button type="button" onClick={() => go(true)} disabled={submitting} className="ml-auto rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
              Skip
            </button>
            <button
              type="button"
              onClick={() => go(false)}
              disabled={submitting}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-on-color shadow-lg shadow-brand/25 transition hover:bg-brand/90 active:scale-[0.98] disabled:opacity-70"
            >
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              See my report
              {!submitting && <ArrowRight className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      {/* Live preview: what the chosen priorities look like on this block. */}
      <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] border-l border-border lg:block" aria-label="Preview map">
        {center ? (
          <div className="absolute inset-0">
            <CityMapLazy center={center} places={nearbyOk?.places ?? []} highlight={highlight} zones={zones.data ?? null} frame={frame} className="size-full" />
          </div>
        ) : (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 p-4">
          <div className="animate-rise inline-flex max-w-full items-center gap-3 rounded-2xl bg-card/92 px-4 py-3 shadow-lg ring-1 ring-foreground/8 backdrop-blur-xl" aria-live="polite">
            {nearby.status === "loading" || !center ? (
              <>
                <Loader2 className="size-4 animate-spin text-brand" aria-hidden />
                <span className="text-sm">Mapping the neighborhood…</span>
              </>
            ) : selected.length === 0 ? (
              <span className="text-sm text-muted-foreground">Pick a priority to see it on the map</span>
            ) : (
              <>
                <span className="font-display text-3xl leading-none tabular-nums">{matched}</span>
                <span className="text-sm leading-tight text-muted-foreground">
                  places match your priorities
                  <br />
                  within a 15-minute walk
                </span>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
