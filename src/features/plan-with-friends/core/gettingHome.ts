import type { Point } from "./fairness";

/** NYC fares as of Jan 2026: MTA base fare; Citi Bike e-bike for non-members; TLC yellow-cab meter. */
export const FARES = {
  subway: 3,
  bikeUnlock: 4.99,
  bikePerMin: 0.41,
  taxiStart: 3,
  taxiPerMile: 3.5,
  taxiMta: 0.5,
  taxiImprovement: 1,
  taxiOvernight: 1,
  taxiManhattan: 2.5,
  taxiCongestion: 0.75,
} as const;

export type HomeMode = "subway" | "bike" | "taxi" | "walk";

export interface ModeEstimates {
  /** Door to door by subway, or null when no train makes sense. */
  subway: number | null;
  bike: number;
  taxi: number;
  walk: number;
  /** Road distance, for the taxi meter. */
  miles: number;
}

export interface HomeOption {
  mode: HomeMode;
  minutes: number;
  cost: number;
}

export interface HomePlan {
  options: HomeOption[];
  best: HomeMode;
  warning: string | null;
}

/** A rough outline of Manhattan (lat, lon), enough to decide which taxi surcharges apply. */
const MANHATTAN: [number, number][] = [
  [40.700, -74.020], [40.710, -73.975], [40.745, -73.968], [40.776, -73.941], [40.800, -73.928], [40.835, -73.933],
  [40.874, -73.910], [40.880, -73.927], [40.820, -73.962], [40.760, -74.010],
];

function inManhattan(p: Point): boolean {
  let inside = false;
  for (let i = 0, j = MANHATTAN.length - 1; i < MANHATTAN.length; j = i++) {
    const [yi, xi] = MANHATTAN[i];
    const [yj, xj] = MANHATTAN[j];
    if (yi > p.lat !== yj > p.lat && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const inManhattanBelow = (p: Point, lat: number) => p.lat < lat && inManhattan(p);

export function bikeCost(minutes: number): number {
  return FARES.bikeUnlock + minutes * FARES.bikePerMin;
}

/** The metered fare before tip. Surcharges follow the TLC schedule; the meter itself is approximated by distance. */
export function taxiCost({ miles, from, to, atMin }: { miles: number; from: Point; to: Point; atMin: number }): number {
  const hour = Math.floor((atMin % 1440) / 60);
  let fare = FARES.taxiStart + miles * FARES.taxiPerMile + FARES.taxiMta + FARES.taxiImprovement;
  if (hour >= 20 || hour < 6) fare += FARES.taxiOvernight;
  if (inManhattanBelow(from, 40.795) || inManhattanBelow(to, 40.795)) fare += FARES.taxiManhattan;
  if (inManhattanBelow(from, 40.768) || inManhattanBelow(to, 40.768)) fare += FARES.taxiCongestion;
  return Math.round(fare * 100) / 100;
}

/** Extra waiting as trains thin out late at night (minutes after midnight of the plan day). */
export function nightWaitMin(atMin: number): number {
  if (atMin < 23 * 60) return 0;
  if (atMin < 24 * 60 + 60) return 8;
  return 15;
}

const clockLabel = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
};

/** Every sensible way home from the last stop, and the one we'd pick: a dollar is worth about two minutes. */
export function homeOptions(est: ModeEstimates, trip: { from: Point; to: Point; atMin: number }): HomePlan {
  const wait = nightWaitMin(trip.atMin);
  const options: HomeOption[] = [];
  if (est.subway !== null) options.push({ mode: "subway", minutes: Math.round(est.subway + wait), cost: FARES.subway });
  options.push({ mode: "bike", minutes: Math.round(est.bike), cost: Math.round(bikeCost(est.bike) * 100) / 100 });
  options.push({ mode: "taxi", minutes: Math.round(est.taxi), cost: taxiCost({ miles: est.miles, ...trip }) });
  options.push({ mode: "walk", minutes: Math.round(est.walk), cost: 0 });

  const score = (o: HomeOption) => o.minutes + o.cost * 2 + (o.mode === "walk" && o.minutes > 25 ? 1000 : 0);
  const best = options.reduce((a, b) => (score(b) < score(a) ? b : a)).mode;

  let warning: string | null = null;
  const subway = options.find((o) => o.mode === "subway");
  if (subway && wait > 0 && subway.minutes >= 40) {
    warning = `Late trains: the subway home takes about ${subway.minutes} min now. Leave by ${clockLabel(23 * 60 - 30)} for regular service, or take the ${best === "subway" ? "e-bike" : best}.`;
  }
  return { options, best, warning };
}
