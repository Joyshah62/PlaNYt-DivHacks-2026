import { inNycArea } from "@/lib/osm/geo";
import type { StopInput } from "@/lib/plan/types";
import type { Category } from "./categories";
import { fallbackIntent } from "./intent";
import { searchGoogle, searchLocal } from "./sources";
import type { Candidate, Intent } from "./types";

const CITY = [{ lat: 40.71, lon: -73.98, radius: 30_000 }];

export function placeName(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(new york city|new york|nyc|ny)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Search the actual description, without an LLM rewriting it as a guessed venue. */
export function lookupIntent(query: string, category?: Category): Intent {
  // A placement landmark isn't the category being looked up.
  const base = fallbackIntent(query.split(/\b(?:after|before|following)\b/i)[0], null);
  return { ...base, category: category ?? base.category, searchText: query, cuisine: null, keywords: [], price: null, minRating: null, summary: query.slice(0, 60) };
}

export async function lookupCandidates(query: string, category?: Category): Promise<Candidate[] | null> {
  const found = await searchGoogle(CITY, lookupIntent(query, category));
  return found?.filter(inNycArea).slice(0, 6) ?? null;
}

/** A business must match a provider's name, not merely geocode to some NYC point. */
export async function exactPlace(name: string): Promise<Candidate | null> {
  const intent = lookupIntent(name);
  const google = await lookupCandidates(name);
  const candidates = google ?? await searchLocal(CITY, { ...intent, keywords: [name] }) ?? [];
  const matches = candidates.filter((p) => inNycArea(p) && placeName(p.name) === placeName(name));
  // Multiple branches need a neighborhood/address choice before one is added.
  return matches.length === 1 ? matches[0] : null;
}

export function candidateStop(place: Candidate, visitMin: number | null): StopInput {
  return { key: `place-${place.id}`.slice(0, 80), name: place.name.slice(0, 120), lat: place.lat, lon: place.lon, visitMin: visitMin ?? 60, attractionId: null, hours: place.hours };
}
