import type { LatLon } from "./types";

export interface Destination extends LatLon {
  id: string;
  label: string;
  /** Shown in suggestions so "Columbia" is recognisable before it's picked. */
  hint: string;
  /** Presets appear in every commute report; schools only when chosen. */
  preset: boolean;
}

/** Geocoded once, by hand. No runtime lookups for these. */
export const NYC_DESTINATIONS: Destination[] = [
  { id: "times-square", label: "Times Square", hint: "Midtown", preset: true, lat: 40.758, lon: -73.9855 },
  { id: "grand-central", label: "Grand Central", hint: "Midtown East", preset: true, lat: 40.7527, lon: -73.9772 },
  { id: "penn-station", label: "Penn Station", hint: "Midtown West", preset: false, lat: 40.7506, lon: -73.9935 },
  { id: "wtc", label: "World Trade Center", hint: "Financial District", preset: true, lat: 40.7115, lon: -74.011 },
  { id: "union-square", label: "Union Square", hint: "Manhattan", preset: true, lat: 40.7359, lon: -73.9906 },
  { id: "central-park", label: "Central Park", hint: "Bethesda Terrace", preset: true, lat: 40.7736, lon: -73.9712 },
  { id: "downtown-brooklyn", label: "Downtown Brooklyn", hint: "Borough Hall", preset: true, lat: 40.6931, lon: -73.9897 },
  { id: "lic", label: "Long Island City", hint: "Court Square, Queens", preset: false, lat: 40.7471, lon: -73.9456 },
  { id: "jfk", label: "JFK Airport", hint: "Queens", preset: true, lat: 40.6413, lon: -73.7781 },
  { id: "lga", label: "LaGuardia Airport", hint: "Queens", preset: true, lat: 40.7769, lon: -73.874 },
  { id: "nyu", label: "NYU", hint: "Washington Square", preset: false, lat: 40.7295, lon: -73.9965 },
  { id: "nyu-tandon", label: "NYU Tandon", hint: "Downtown Brooklyn", preset: false, lat: 40.6942, lon: -73.9866 },
  { id: "columbia", label: "Columbia University", hint: "Morningside Heights", preset: false, lat: 40.8075, lon: -73.9626 },
  { id: "hunter", label: "Hunter College", hint: "Upper East Side", preset: false, lat: 40.7685, lon: -73.9646 },
  { id: "baruch", label: "Baruch College", hint: "Gramercy", preset: false, lat: 40.7402, lon: -73.9834 },
  { id: "city-college", label: "City College", hint: "Harlem", preset: false, lat: 40.82, lon: -73.9493 },
  { id: "brooklyn-college", label: "Brooklyn College", hint: "Midwood", preset: false, lat: 40.631, lon: -73.9525 },
  { id: "queens-college", label: "Queens College", hint: "Flushing", preset: false, lat: 40.7367, lon: -73.8203 },
  { id: "new-school", label: "The New School", hint: "Greenwich Village", preset: false, lat: 40.7355, lon: -73.9971 },
  { id: "fordham-lc", label: "Fordham Lincoln Center", hint: "Upper West Side", preset: false, lat: 40.7713, lon: -73.9853 },
  { id: "pratt", label: "Pratt Institute", hint: "Clinton Hill", preset: false, lat: 40.6913, lon: -73.9632 },
  { id: "cooper-union", label: "Cooper Union", hint: "East Village", preset: false, lat: 40.7292, lon: -73.9906 },
  { id: "fit", label: "FIT", hint: "Chelsea", preset: false, lat: 40.7473, lon: -73.9951 },
  { id: "st-johns", label: "St. John's University", hint: "Jamaica, Queens", preset: false, lat: 40.7223, lon: -73.7949 },
];

export const PRESET_DESTINATIONS = NYC_DESTINATIONS.filter((d) => d.preset);

/** Match a typed destination to a known one by id or (loosely) by label. */
export function findKnownDestination(text: string): Destination | null {
  const q = text.trim().toLowerCase();
  if (!q) return null;
  return (
    NYC_DESTINATIONS.find((d) => d.id === q || d.label.toLowerCase() === q) ?? null
  );
}

export function searchKnownDestinations(text: string, limit = 5): Destination[] {
  const q = text.trim().toLowerCase();
  if (q.length < 2) return [];
  return NYC_DESTINATIONS.filter(
    (d) => d.label.toLowerCase().includes(q) || d.hint.toLowerCase().includes(q),
  ).slice(0, limit);
}
