"use client";

import { Bus, Car, ChevronRight, CircleAlert, Footprints, TrainFront } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { Skeleton } from "@/components/ui/skeleton";
import { DESTINATION_ICONS, categoryStyle } from "@/components/neighborhood/meta";
import { NYC_DESTINATIONS } from "@/lib/osm/places";
import type { CommuteReport, CommuteRow, NearbyReport } from "@/lib/osm/types";
import type { Fetched } from "@/lib/useJson";
import { cn } from "@/lib/utils";
import { SectionError } from "./Section";

/** Longer than this, a walk is not a commute option worth listing. */
const MAX_WALK = 45;

export function CommuteTab({
  commute,
  nearby,
  onRetry,
  selectedId,
  onSelect,
  onSelectStation,
}: {
  commute: Fetched<CommuteReport>;
  nearby: Fetched<NearbyReport>;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSelectStation: (placeId: string) => void;
}) {
  const report = commute.data;
  const n = nearby.data?.placesStatus.ok ? nearby.data : null;
  const [station, next] = n?.categories.find((c) => c.id === "subway")?.nearest ?? [];
  const buses = n?.categories.find((c) => c.id === "bus")?.within5 ?? null;
  const custom = report?.rows.filter((r) => r.kind !== "preset") ?? [];
  const presets = report?.rows.filter((r) => r.kind === "preset") ?? [];
  const maxDrive = Math.max(1, ...(report?.rows.map((r) => r.driveMin ?? 0) ?? []));

  return (
    <div className="space-y-8">
      <section aria-labelledby="transit-title">
        <h2 id="transit-title" className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Transit on foot
        </h2>
        {!n ? (
          nearby.status === "error" || nearby.data ? null : <Skeleton className="h-32 rounded-2xl" />
        ) : (
          <div className="grid grid-cols-[1.5fr_1fr] gap-2.5">
            <button
              type="button"
              disabled={!station}
              onClick={() => station && onSelectStation(station.id)}
              style={categoryStyle("subway")}
              className="group rounded-2xl bg-(--c) p-4 text-left text-on-color shadow-lg shadow-(--c)/25 transition enabled:hover:-translate-y-0.5"
            >
              <TrainFront className="size-5" aria-hidden />
              {station ? (
                <>
                  <p className="mt-2 flex items-baseline gap-1">
                    <span className="font-display text-5xl leading-none">
                      {station.estimated ? "~" : ""}
                      <CountUp value={station.walkMin} />
                    </span>
                    <span className="text-sm text-on-color/80">min walk</span>
                  </p>
                  <p className="mt-1.5 truncate text-sm font-medium">{station.name}</p>
                  {next && <p className="truncate text-xs text-on-color/75">Next: {next.name} · {next.walkMin} min</p>}
                </>
              ) : (
                <p className="mt-3 text-sm">No station within {(n.radiusMeters / 1000).toFixed(1)} km.</p>
              )}
            </button>
            <div className="rounded-2xl border border-border bg-card p-4" style={categoryStyle("bus")}>
              <Bus className="size-5 text-(--c)" aria-hidden />
              <p className="mt-2 font-display text-5xl leading-none">{buses === null ? "—" : <CountUp value={buses} />}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">bus stops within a 5-min walk</p>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="dest-title">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="dest-title" className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Trips from here
          </h2>
          <span className="text-xs text-muted-foreground">Tap to draw the route</span>
        </div>
        {commute.status === "error" ? (
          <SectionError message="Travel times couldn't load right now." onRetry={onRetry} />
        ) : !report ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading travel times">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {report.unresolved.length > 0 && (
              <p className="mb-3 flex items-start gap-2 rounded-xl bg-sev-b-soft px-4 py-3 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-sev-b" aria-hidden />
                <span>We couldn&apos;t find {report.unresolved.map((u) => `“${u}”`).join(", ")}. Try a street address.</span>
              </p>
            )}
            <div className="space-y-4">
              {custom.length > 0 && <Group title="Your places" rows={custom} maxDrive={maxDrive} selectedId={selectedId} onSelect={onSelect} />}
              <Group title="Around the city" rows={presets} maxDrive={maxDrive} selectedId={selectedId} onSelect={onSelect} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              OSRM estimates on OpenStreetMap roads: no live traffic, no transit schedules. Rush hour will be slower.
              {!report.routingStatus.ok && " Routing was unavailable, so these are straight-line estimates (~)."}
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function Group({
  title,
  rows,
  maxDrive,
  selectedId,
  onSelect,
}: {
  title: string;
  rows: CommuteRow[];
  maxDrive: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-[11px] font-medium text-muted-foreground">{title}</p>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map((row) => {
          const Icon = DESTINATION_ICONS[row.kind];
          const hint = row.kind === "preset" ? NYC_DESTINATIONS.find((d) => d.id === row.id)?.hint : row.kind === "other" ? "Yours" : row.kind === "work" ? "Work" : "School";
          const on = selectedId === row.id;
          const approx = row.estimated ? "~" : "";
          return (
            <li key={row.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(row.id)}
                className={cn("group flex w-full items-center gap-3 px-3.5 py-3 text-left transition", on ? "bg-brand-soft" : "hover:bg-muted/60")}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", row.kind === "preset" ? "bg-muted text-foreground" : "bg-brand text-on-color")}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.label}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>
                    <span className="h-1 max-w-28 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-brand/70" style={{ width: `${((row.driveMin ?? 0) / maxDrive) * 100}%` }} />
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="flex items-center justify-end gap-1 text-sm font-semibold tabular-nums">
                    <Car className="size-3.5 text-muted-foreground" aria-hidden />
                    {row.driveMin === null ? "—" : `${approx}${row.driveMin} min`}
                  </span>
                  <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground tabular-nums">
                    {row.walkMin !== null && row.walkMin <= MAX_WALK ? (
                      <>
                        <Footprints className="size-3" aria-hidden />
                        {approx}
                        {row.walkMin} min
                      </>
                    ) : (
                      row.driveMiles !== null && `${row.driveMiles} mi`
                    )}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
