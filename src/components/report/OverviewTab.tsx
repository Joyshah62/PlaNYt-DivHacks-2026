"use client";

import Link from "next/link";
import { ArrowRight, Car, Crosshair, ShieldAlert, ShoppingBasket, Sparkles, TrainFront } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_ICONS, PREFERENCE_ICONS, categoryStyle } from "@/components/neighborhood/meta";
import { CATEGORIES } from "@/lib/osm/categories";
import type { BuildingReport } from "@/lib/nyc/types";
import type { CategoryId, CommuteReport, NearbyReport } from "@/lib/osm/types";
import { PREFERENCES, preferenceDef, type LifestyleHighlight, type PreferenceId } from "@/lib/preferences";
import type { Fetched } from "@/lib/useJson";
import { cn } from "@/lib/utils";

export type GlanceTarget =
  | { kind: "place"; id: string }
  | { kind: "category"; id: CategoryId }
  | { kind: "building" }
  | { kind: "destination"; id: string };

function Stat({
  icon: Icon,
  value,
  unit,
  caption,
  tone,
  loading,
  onClick,
  delay,
}: {
  icon: typeof TrainFront;
  value: number | null;
  unit?: string;
  caption: string;
  tone?: "alert";
  loading: boolean;
  onClick?: () => void;
  delay: number;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <Skeleton className="size-5 rounded" />
        <Skeleton className="mt-3 h-9 w-14" />
        <Skeleton className="mt-2 h-3 w-24" />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
      className="animate-rise group rounded-2xl border border-border bg-card p-4 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-foreground/15 enabled:hover:shadow-lg enabled:hover:shadow-foreground/5"
    >
      <div className="flex items-center justify-between">
        <Icon className={cn("size-[18px]", tone === "alert" ? "text-sev-c" : "text-muted-foreground")} aria-hidden />
        {onClick && <ArrowRight className="size-3.5 -translate-x-1 text-muted-foreground opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />}
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span className={cn("font-display text-[2.6rem] leading-none tracking-tight", tone === "alert" && "text-sev-c")}>
          {value === null ? "—" : <CountUp value={value} />}
        </span>
        {unit && value !== null && <span className="text-sm text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{caption}</p>
    </button>
  );
}

export function OverviewTab({
  nearby,
  commute,
  building,
  prefs,
  highlights,
  highlightLoading,
  focusedPref,
  onFocusHighlight,
  onGo,
  editHref,
}: {
  nearby: Fetched<NearbyReport>;
  commute: Fetched<CommuteReport>;
  building: Fetched<BuildingReport>;
  prefs: PreferenceId[];
  highlights: LifestyleHighlight[];
  highlightLoading: (id: PreferenceId) => boolean;
  focusedPref: PreferenceId | null;
  onFocusHighlight: (h: LifestyleHighlight | null) => void;
  onGo: (target: GlanceTarget) => void;
  editHref: string;
}) {
  const n = nearby.data?.placesStatus.ok ? nearby.data : null;
  const nearbyLoading = nearby.status === "loading" || nearby.status === "idle";
  const station = n?.categories.find((c) => c.id === "subway")?.nearest[0] ?? null;
  const groceries = n?.categories.find((c) => c.id === "groceries");
  const snap = building.data?.snapshot;
  const hazardous = snap && snap.openClassB !== null && snap.openClassC !== null ? snap.openClassB + snap.openClassC : null;
  const trip = commute.data?.rows.find((r) => r.kind !== "preset") ?? commute.data?.rows.find((r) => r.id === "times-square") ?? null;

  return (
    <div className="space-y-10">
      <section aria-labelledby="glance-title">
        <h2 id="glance-title" className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          At a glance
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat
            icon={TrainFront}
            value={station?.walkMin ?? null}
            unit="min"
            caption={station ? `walk to ${station.name}` : n ? "No station within 1.2 km" : "Subway unavailable"}
            loading={nearbyLoading}
            onClick={station ? () => onGo({ kind: "place", id: station.id }) : undefined}
            delay={0}
          />
          <Stat
            icon={ShoppingBasket}
            value={groceries?.within10 ?? null}
            caption={groceries ? `grocery ${groceries.within10 === 1 ? "store" : "stores"} within a 10-min walk` : "Groceries unavailable"}
            loading={nearbyLoading}
            onClick={groceries ? () => onGo({ kind: "category", id: "groceries" }) : undefined}
            delay={50}
          />
          <Stat
            icon={ShieldAlert}
            value={hazardous}
            tone={hazardous ? "alert" : undefined}
            caption={hazardous === null ? "Violation records unavailable" : "hazardous HPD violations listed open"}
            loading={building.status === "loading"}
            onClick={() => onGo({ kind: "building" })}
            delay={100}
          />
          <Stat
            icon={Car}
            value={trip?.driveMin ?? null}
            unit="min"
            caption={trip ? `drive to ${trip.label}` : "Travel times unavailable"}
            loading={commute.status === "loading" || commute.status === "idle"}
            onClick={trip ? () => onGo({ kind: "destination", id: trip.id }) : undefined}
            delay={150}
          />
        </div>
      </section>

      <section aria-labelledby="fit-title">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="fit-title" className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Your priorities
          </h2>
          {prefs.length > 0 && <span className="text-xs text-muted-foreground">Tap to see them on the map</span>}
        </div>
        {prefs.length === 0 ? (
          <Link href={editHref} className="group relative block overflow-hidden rounded-2xl bg-foreground p-6 text-background">
            <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-brand/50 blur-3xl" />
            <Sparkles className="relative size-5" aria-hidden />
            <p className="relative mt-3 font-display text-2xl leading-snug">Tell us what matters, and we&apos;ll answer for this exact address.</p>
            <div className="relative mt-4 flex flex-wrap gap-1.5">
              {PREFERENCES.slice(0, 6).map((p) => {
                const Icon = PREFERENCE_ICONS[p.id];
                return (
                  <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-background/12 px-2.5 py-1 text-xs">
                    <Icon className="size-3" aria-hidden /> {p.label}
                  </span>
                );
              })}
            </div>
            <span className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
              Choose priorities <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
            </span>
          </Link>
        ) : (
          <div className="space-y-2">
            {prefs.map((id, i) => {
              const h = highlights.find((x) => x.pref === id);
              const def = preferenceDef(id);
              const Icon = PREFERENCE_ICONS[id];
              if (!h || highlightLoading(id)) {
                return <Skeleton key={id} className="h-[76px] rounded-2xl" />;
              }
              const focusable = h.placeIds.length > 0;
              const on = focusedPref === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!focusable}
                  aria-pressed={focusable ? on : undefined}
                  onClick={() => onFocusHighlight(on ? null : h)}
                  style={{ ...categoryStyle(def.category), "--delay": `${i * 45}ms` } as React.CSSProperties}
                  className={cn(
                    "animate-rise group flex w-full items-center gap-4 rounded-2xl border bg-card p-3.5 pr-4 text-left transition",
                    on ? "border-(--c) shadow-[0_0_0_1px_var(--c)]" : "border-border enabled:hover:border-foreground/15 enabled:hover:shadow-md",
                  )}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-(--c)/12 text-(--c)">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{h.label}</span>
                    <span className="block text-[13px] leading-snug text-foreground/80">{h.caption}</span>
                    {h.detail && h.value !== null && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{h.detail}</span>}
                  </span>
                  <span className={cn("shrink-0 font-display text-4xl leading-none", h.value === 0 && "text-muted-foreground")}>
                    {h.value === null ? "—" : <CountUp value={h.value} />}
                    {h.unit === "minutes" && h.value !== null && <span className="ml-0.5 font-sans text-xs text-muted-foreground">min</span>}
                  </span>
                  {focusable && <Crosshair className={cn("size-4 shrink-0 transition", on ? "text-(--c)" : "text-muted-foreground/40 group-hover:text-muted-foreground")} aria-hidden />}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <MixBar nearby={n} loading={nearbyLoading} onPick={(id) => onGo({ kind: "category", id })} />
    </div>
  );
}

/** One bar that shows the neighborhood's make-up at a glance; every piece is a door into the map. */
function MixBar({ nearby, loading, onPick }: { nearby: NearbyReport | null; loading: boolean; onPick: (id: CategoryId) => void }) {
  if (loading) return <Skeleton className="h-28 rounded-2xl" />;
  if (!nearby) return null;
  const parts = CATEGORIES.filter((c) => c.id !== "bus")
    .map((c) => ({ ...c, count: nearby.categories.find((s) => s.id === c.id)?.within10 ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = parts.reduce((s, p) => s + p.count, 0);

  return (
    <section aria-labelledby="mix-title">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="mix-title" className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Within a 10-minute walk
        </h2>
        <span className="font-display text-xl tabular-nums">{total} places</span>
      </div>
      {total === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">No everyday places mapped within a 10-minute walk.</p>
      ) : (
        <>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {parts.map((p) => (
              <span key={p.id} className="h-full transition-[flex-grow] duration-700" style={{ ...categoryStyle(p.id), flexGrow: p.count, background: "var(--c)" }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {parts.map((p) => {
              const Icon = CATEGORY_ICONS[p.id];
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onPick(p.id)}
                    style={categoryStyle(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-2.5 pl-1.5 text-xs transition hover:border-(--c)"
                  >
                    <span className="grid size-5 place-items-center rounded-full bg-(--c) text-on-color">
                      <Icon className="size-3" aria-hidden />
                    </span>
                    {p.label}
                    <span className="font-semibold tabular-nums">{p.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
