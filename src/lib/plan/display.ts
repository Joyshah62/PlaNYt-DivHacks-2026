import type { CrowdBand } from "./crowd";
import type { LegMode, TravelMode } from "./types";

/** The product's name, in one place. */
export const BRAND = { name: "Roam", suffix: "NYC" };

export const CROWD_COLOR: Record<CrowdBand, string> = {
  quiet: "var(--cat-parks)",
  moderate: "var(--sev-b)",
  busy: "var(--cat-restaurants)",
  peak: "var(--sev-c)",
};

export const CROWD_LABEL: Record<CrowdBand, string> = {
  quiet: "Quiet",
  moderate: "Moderate",
  busy: "Busy",
  peak: "Peak time",
};

export const MODE_LABEL: Record<TravelMode, string> = {
  transit: "Subway + walk",
  walk: "Walk",
  bike: "Bike",
  car: "Car",
};

export const LEG_VERB: Record<LegMode, string> = {
  walk: "walk",
  subway: "by subway",
  bike: "bike",
  car: "drive",
};
