"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Camera, Check, CircleAlert, Loader2, Pencil, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PREFERENCE_ICONS } from "@/components/neighborhood/meta";
import { preferenceDef, type PreferenceId } from "@/lib/preferences";
import type { BuildingInfo } from "@/lib/nyc/types";

export type InputState = "loading" | "ready" | "failed";

export interface HeaderPlace {
  address: string;
  borough: string;
  zip: string | null;
}

/** Address, building facts, the reader's priorities, and the score to come. */
export function PanelHeader({
  place,
  building,
  buildingLoading,
  prefs,
  editHref,
  inputs,
}: {
  place: HeaderPlace | null;
  building: BuildingInfo | null;
  buildingLoading: boolean;
  prefs: PreferenceId[];
  editHref: string;
  inputs: { label: string; state: InputState }[];
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!place) {
    return (
      <div className="px-5 pt-7 pb-6 sm:px-8" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-12 w-4/5" />
        <Skeleton className="mt-4 h-8 w-2/3 rounded-full" />
      </div>
    );
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const location = `${place.address}, ${place.borough}, NY ${place.zip ?? ""}`;
  const mapUrl = `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: location })}`;
  const imageUrl = key
    ? `https://maps.googleapis.com/maps/api/streetview?${new URLSearchParams({ size: "640x400", location, key, source: "outdoor", return_error_code: "true" })}`
    : null;
  const facts = building
    ? ([
        building.yearBuilt && `Built ${building.yearBuilt}`,
        building.units && `${building.units.toLocaleString()} ${building.units === 1 ? "unit" : "units"}`,
        building.floors && `${building.floors} ${building.floors === 1 ? "floor" : "floors"}`,
      ].filter(Boolean) as string[])
    : [];
  const ready = inputs.filter((i) => i.state === "ready").length;

  return (
    <div className="animate-rise px-5 pt-7 pb-6 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {place.borough} · NY {place.zip ?? ""}
      </p>
      <h1 className="mt-2 font-display text-[2.6rem] leading-[1.02] tracking-tight text-balance sm:text-5xl">{place.address}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        {buildingLoading && <Skeleton className="h-4 w-40" />}
        {facts.length > 0 && <span className="text-foreground/80">{facts.join(" · ")}</span>}
        <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand hover:underline print:hidden">
          Google Maps <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
        {imageUrl && (
          <details className="print:hidden open:basis-full">
            <summary className="inline-flex cursor-pointer items-center gap-1 text-brand hover:underline">
              <Camera className="size-3.5" aria-hidden /> Street photo
            </summary>
            <figure className="mt-3">
              {!imageFailed ? (
                // Keep the full image, including Google's attribution.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={`Google Street View near ${location}`} width={640} height={400} loading="lazy" onError={() => setImageFailed(true)} className="w-full rounded-xl object-contain" />
              ) : (
                <p className="text-sm">Street imagery is unavailable. Use the map link to check the address.</p>
              )}
              <figcaption className="mt-2 text-xs">Imagery may be dated or show a nearby entrance. It is not evidence of current conditions.</figcaption>
            </figure>
          </details>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-1.5 print:hidden">
        {prefs.length > 0 ? (
          <>
            {prefs.map((id) => {
              const Icon = PREFERENCE_ICONS[id];
              return (
                <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium">
                  <Icon className="size-3.5 text-brand" aria-hidden />
                  {preferenceDef(id).label}
                </span>
              );
            })}
            <Link href={editHref} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <Pencil className="size-3" aria-hidden /> Edit
            </Link>
          </>
        ) : (
          <Link href={editHref} className="group inline-flex items-center gap-2 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-on-color shadow-sm shadow-brand/30 transition hover:bg-brand/90">
            <Sparkles className="size-3.5" aria-hidden /> Personalize with your priorities
          </Link>
        )}
      </div>

      {/* The score slot: honest that it's coming, live about what it will use. */}
      <div className="mt-5 flex items-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 p-3.5">
        <svg viewBox="0 0 44 44" className="size-11 shrink-0" aria-hidden>
          <circle cx="22" cy="22" r="18" fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(ready / inputs.length) * 113} 113`}
            transform="rotate(-90 22 22)"
            className="transition-[stroke-dasharray] duration-700"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Match score <span className="ml-1 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-brand uppercase">Soon</span>
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground" aria-live="polite">
            {inputs.map((i) => (
              <li key={i.label} className="inline-flex items-center gap-1">
                {i.state === "loading" && <Loader2 className="size-3 animate-spin" aria-hidden />}
                {i.state === "ready" && <Check className="size-3 text-brand" strokeWidth={3} aria-hidden />}
                {i.state === "failed" && <CircleAlert className="size-3 text-sev-b" aria-hidden />}
                {i.label}
                <span className="sr-only">: {i.state}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
