import { NEAREST_PER_CATEGORY, summarize, toPlaces, type OverpassElement } from "./categories";
import { METERS_PER_MILE, WALKABLE_METERS, estimateDriveMin, estimateWalkMin, haversine } from "./geo";
import { toMinutes, type TableLeg } from "./osrm";
import type {
  CommuteReport,
  CommuteRow,
  DestinationKind,
  LatLon,
  NearbyReport,
  Place,
  SourceStatus,
} from "./types";

/** The closest few per category - the only places worth a routed walk time. */
export function placesToRoute(places: Place[]): Place[] {
  const seen = new Map<string, number>();
  return places.filter((p) => {
    const n = seen.get(p.category) ?? 0;
    seen.set(p.category, n + 1);
    return n < NEAREST_PER_CATEGORY;
  });
}

/** Swap estimated walk times for routed ones where OSRM answered. */
export function applyRoutedWalks(places: Place[], routed: Place[], legs: TableLeg[] | null): Place[] {
  if (!legs) return places;
  const byId = new Map<string, number | null>();
  routed.forEach((p, i) => byId.set(p.id, toMinutes(legs[i]?.duration ?? null)));
  return places.map((p) => {
    const minutes = byId.get(p.id);
    return minutes ? { ...p, walkMin: minutes, estimated: false } : p;
  });
}

export async function buildNearbyReport(input: {
  center: LatLon;
  radiusMeters: number;
  elements: OverpassElement[];
  placesStatus: SourceStatus;
  routeLegs: (routed: Place[]) => Promise<TableLeg[] | null>;
  now: Date;
}): Promise<NearbyReport> {
  const places = toPlaces(input.elements, input.center);
  const routed = placesToRoute(places);
  const legs = input.placesStatus.ok && routed.length > 0 ? await input.routeLegs(routed) : null;
  const finalPlaces = applyRoutedWalks(places, routed, legs);

  return {
    center: input.center,
    radiusMeters: input.radiusMeters,
    categories: input.placesStatus.ok ? summarize(finalPlaces) : [],
    places: finalPlaces,
    placesStatus: input.placesStatus,
    routingStatus: {
      ok: routed.length === 0 || legs !== null,
      source: "OSRM walking routes (routing.openstreetmap.de)",
      retrievedAt: legs ? input.now.toISOString() : null,
      error: legs || routed.length === 0 ? null : "Walking routes unavailable; times are straight-line estimates.",
    },
    generatedAt: input.now.toISOString(),
  };
}

export interface CommuteTarget extends LatLon {
  id: string;
  label: string;
  kind: DestinationKind;
}

export function buildCommuteRows(
  center: LatLon,
  targets: CommuteTarget[],
  walk: TableLeg[] | null,
  drive: TableLeg[] | null,
): CommuteRow[] {
  return targets.map((t, i) => {
    const straight = haversine(center, t);
    const walkLeg = walk?.[i];
    const driveLeg = drive?.[i];
    const walkMin = walkLeg
      ? toMinutes(walkLeg.duration)
      : straight <= WALKABLE_METERS
        ? estimateWalkMin(straight)
        : null;
    const driveMin = driveLeg ? toMinutes(driveLeg.duration) : estimateDriveMin(straight);
    const driveMeters = driveLeg ? driveLeg.distance : straight * 1.3;
    return {
      id: t.id,
      label: t.label,
      kind: t.kind,
      lat: t.lat,
      lon: t.lon,
      walkMin,
      driveMin,
      driveMiles: driveMeters === null ? null : Math.round((driveMeters / METERS_PER_MILE) * 10) / 10,
      estimated: !walkLeg || !driveLeg,
    };
  });
}

export function buildCommuteReport(input: {
  center: LatLon;
  targets: CommuteTarget[];
  unresolved: string[];
  walk: TableLeg[] | null;
  drive: TableLeg[] | null;
  now: Date;
}): CommuteReport {
  const ok = input.targets.length === 0 || (input.walk !== null && input.drive !== null);
  return {
    center: input.center,
    rows: buildCommuteRows(input.center, input.targets, input.walk, input.drive),
    unresolved: input.unresolved,
    routingStatus: {
      ok,
      source: "OSRM walking + driving routes (routing.openstreetmap.de)",
      retrievedAt: ok ? input.now.toISOString() : null,
      error: ok ? null : "Routing unavailable; times are straight-line estimates.",
    },
    generatedAt: input.now.toISOString(),
  };
}
