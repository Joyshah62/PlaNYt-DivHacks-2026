import { haversine } from "@/lib/osm/geo";
import type { LatLon } from "@/lib/osm/types";
import data from "./crowd-data.json";

/**
 * Area busyness from MTA subway ridership: how many people tap in at the
 * stations nearby, by weekday and hour, relative to the area's busiest hour
 * that day. It is a proxy for foot traffic around a place, not a headcount
 * inside it - venue-level crowd data is not public - and the UI labels it so.
 */

export interface Station extends LatLon {
  id: string;
  name: string;
  borough: string;
  /** Typical riders per hour; index = weekday (0 = Sunday) * 24 + hour. */
  riders: number[];
}

export const STATIONS: Station[] = data.stations;
export const CROWD_SOURCE = { name: data.source, weeks: data.weeks };

/** Stations this close count fully; the weight then fades to zero at the outer radius. */
const FULL_WEIGHT_METERS = 350;
const MAX_STATION_METERS = 900;

export function nearestStations(point: LatLon, count = 1, maxMeters = Infinity): { station: Station; meters: number }[] {
  return STATIONS.map((station) => ({ station, meters: haversine(point, station) }))
    .filter((s) => s.meters <= maxMeters)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, count);
}

export interface CrowdProfile {
  /** The station contributing the most riders, named in the UI. */
  station: string;
  stationMeters: number;
  /** 0..1 for each hour of the chosen weekday, 1 = the area's busiest hour that day. */
  levels: number[];
  /** Typical riders per hour across the area's stations, for the same hours. */
  riders: number[];
}

/**
 * Riders at every station within walking distance, nearer ones counting more.
 * One station alone misleads: the stop nearest Times Square is the small 49 St,
 * while the Times Sq-42 St complex, a block further, carries the crowd.
 */
export function crowdProfile(point: LatLon, dow: number): CrowdProfile | null {
  const near = nearestStations(point, 8, MAX_STATION_METERS);
  if (!near.length) return null;
  const week = new Array<number>(168).fill(0);
  let top = { name: "", meters: 0, riders: -1 };
  for (const { station, meters } of near) {
    const w = meters <= FULL_WEIGHT_METERS ? 1 : 1 - (meters - FULL_WEIGHT_METERS) / (MAX_STATION_METERS - FULL_WEIGHT_METERS);
    let total = 0;
    station.riders.forEach((r, i) => {
      week[i] += r * w;
      total += r * w;
    });
    if (total > top.riders) top = { name: station.name, meters, riders: total };
  }
  const riders = week.slice(dow * 24, dow * 24 + 24).map(Math.round);
  // Relative to that day, not the week: weekday commuter rush would otherwise make
  // every weekend afternoon look quiet, which is not what a visitor finds.
  const peak = Math.max(1, ...riders);
  return {
    station: top.name,
    stationMeters: Math.round(top.meters),
    levels: riders.map((r) => Math.round((r / peak) * 100) / 100),
    riders,
  };
}

// The pure helpers live apart from the ridership data, so the browser can use them without downloading it.
export { crowdBand, levelDuring, type CrowdBand } from "./crowdBand";
