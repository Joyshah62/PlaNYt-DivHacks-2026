"use client";

import { ChevronRight, Footprints } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/segmented";
import { CATEGORY_ICONS, categoryStyle } from "@/components/neighborhood/meta";
import { CATEGORIES, CUISINE_LABELS, categoryLabel } from "@/lib/osm/categories";
import type { CategoryId, NearbyReport, Place } from "@/lib/osm/types";
import type { Fetched } from "@/lib/useJson";
import { cn } from "@/lib/utils";
import { SectionError } from "./Section";

export type Band = 5 | 10 | 15;
const TILES = CATEGORIES.filter((c) => c.id !== "bus");
const LIST_LIMIT = 40;

export function NearbyTab({
  nearby,
  onRetry,
  band,
  onBand,
  category,
  cuisine,
  onCategory,
  selectedId,
  onSelect,
  onHover,
}: {
  nearby: Fetched<NearbyReport>;
  onRetry: () => void;
  band: Band;
  onBand: (b: Band) => void;
  category: CategoryId | null;
  cuisine: string | null;
  onCategory: (id: CategoryId | null, cuisine?: string | null) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const report = nearby.data;
  if (nearby.status === "error" || (report && !report.placesStatus.ok)) {
    return <SectionError message="Nearby places couldn't load from OpenStreetMap right now. That doesn't mean there's nothing here." onRetry={onRetry} />;
  }
  if (!report) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading nearby places">
        <Skeleton className="h-8 w-48 rounded-full" />
        <div className="grid grid-cols-3 gap-2">
          {TILES.map((t) => (
            <Skeleton key={t.id} className="h-[92px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const count = (id: CategoryId) => {
    const s = report.categories.find((c) => c.id === id);
    return !s ? 0 : band === 5 ? s.within5 : band === 10 ? s.within10 : s.within15;
  };

  // With a category: every place in it. Without: the closest of each kind.
  const list: Place[] = category
    ? report.places.filter((p) => p.category === category && (!cuisine || p.cuisine === cuisine)).sort((a, b) => a.walkMin - b.walkMin).slice(0, LIST_LIMIT)
    : TILES.map((t) => report.categories.find((c) => c.id === t.id)?.nearest[0]).filter((p): p is Place => !!p).sort((a, b) => a.walkMin - b.walkMin);

  const food = report.categories.find((c) => c.id === "restaurants");

  return (
    <div className="space-y-8">
      <section aria-labelledby="cat-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="cat-title" className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            On foot
          </h2>
          <Segmented label="Walking time" value={band} onChange={onBand} options={[5, 10, 15].map((b) => ({ value: b as Band, label: `${b} min` }))} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TILES.map(({ id, label }, i) => {
            const Icon = CATEGORY_ICONS[id];
            const n = count(id);
            const on = category === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => onCategory(on ? null : id)}
                style={{ ...categoryStyle(id), "--delay": `${i * 25}ms` } as React.CSSProperties}
                className={cn(
                  "animate-rise group relative flex flex-col items-start rounded-2xl border p-3 text-left transition",
                  on ? "border-transparent bg-(--c) text-on-color shadow-lg shadow-(--c)/30" : "border-border bg-card hover:-translate-y-0.5 hover:border-(--c)/40 hover:shadow-md",
                )}
              >
                <Icon className={cn("size-[18px]", on ? "text-on-color" : "text-(--c)")} aria-hidden />
                <span className={cn("mt-2 font-display text-3xl leading-none", !on && n === 0 && "text-muted-foreground/60")}>
                  <CountUp value={n} />
                </span>
                <span className={cn("mt-1 text-[11px] leading-tight font-medium", on ? "text-on-color/85" : "text-muted-foreground")}>{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {category === "restaurants" && food && food.cuisines.length > 0 && (
        <section aria-labelledby="cuisine-title" style={categoryStyle("restaurants")}>
          <h2 id="cuisine-title" className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Cuisines within 15 minutes
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {food.cuisines.slice(0, 12).map((c) => {
              const on = cuisine === c.cuisine;
              return (
                <button
                  key={c.cuisine}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onCategory("restaurants", on ? null : c.cuisine)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                    on ? "border-(--c) bg-(--c) text-on-color" : "border-border bg-card hover:border-(--c)",
                  )}
                >
                  {CUISINE_LABELS[c.cuisine] ?? c.cuisine}
                  <span className={cn("tabular-nums", on ? "text-on-color/80" : "text-muted-foreground")}>{c.count}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="list-title">
        <h2 id="list-title" className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {category ? `${cuisine ? `${CUISINE_LABELS[cuisine] ?? cuisine} ` : ""}${categoryLabel(category)} · nearest first` : "Closest of each"}
        </h2>
        {list.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            None mapped within {(report.radiusMeters / 1000).toFixed(1)} km.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card" onMouseLeave={() => onHover(null)}>
            {list.map((p) => {
              const Icon = CATEGORY_ICONS[p.category];
              const on = selectedId === p.id;
              return (
                <li key={p.id} style={categoryStyle(p.category)}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onSelect(p.id)}
                    onMouseEnter={() => onHover(p.id)}
                    onFocus={() => onHover(p.id)}
                    className={cn("group flex w-full items-center gap-3 px-3.5 py-3 text-left transition", on ? "bg-(--c)/10" : "hover:bg-muted/60")}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-(--c)/12 text-(--c)">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {category ? (p.cuisine ? CUISINE_LABELS[p.cuisine] : p.street ?? categoryLabel(p.category)) : categoryLabel(p.category)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums text-muted-foreground">
                      <Footprints className="size-3.5" aria-hidden />
                      {p.estimated ? "~" : ""}
                      {p.walkMin} min
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-muted-foreground" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Places © OpenStreetMap contributors. Walk times for the closest few are routed; the rest (~) are estimates.
        </p>
      </section>
    </div>
  );
}
