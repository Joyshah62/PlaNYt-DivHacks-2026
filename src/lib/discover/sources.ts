import { readFile } from "node:fs/promises";
import path from "node:path";
import { haversine } from "@/lib/osm/geo";
import { USER_AGENT } from "@/lib/osm/userAgent";
import type { LatLon } from "@/lib/osm/types";
import { release, reserve } from "@/lib/google/quota";
import { googlePlacesKey } from "@/lib/plan/photos";
import { CATEGORY, type Category } from "./categories";
import { googleHours, parseOsmHours } from "./hours";
import type { Candidate, Intent } from "./types";

/** A circle to search in. */
export interface SearchPoint extends LatLon {
  radius: number;
}

const nearest = (p: LatLon, points: SearchPoint[]) => Math.min(...points.map((q) => haversine(p, q)));
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&");

// --- OpenStreetMap, local copy ------------------------------------------------------

/** [id, name, lat, lon, category, kind tag, cuisine, opening_hours, website, address], from scripts/build-poi-data.mjs. */
type PoiRow = [string, string, number, number, Category, string | null, string | null, string | null, string | null, string | null];
let poiRows: Promise<PoiRow[] | null> | null = null;

/** The downloaded NYC places, read once; null if the data file hasn't been built. */
function loadPois(): Promise<PoiRow[] | null> {
  poiRows ??= readFile(path.join(process.cwd(), "src/lib/discover/poi-data.json"), "utf8")
    .then((text) => (JSON.parse(text) as { places: PoiRow[] }).places)
    .catch(() => null);
  return poiRows;
}

/**
 * The same search as searchOsm, over the local copy of OpenStreetMap: instant,
 * and never rate-limited. Null when there's no local copy.
 */
export async function searchLocal(points: SearchPoint[], intent: Intent): Promise<Candidate[] | null> {
  const rows = await loadPois();
  if (!rows) return null;
  const words = [intent.cuisine, ...intent.keywords].filter((w): w is string => Boolean(w)).map((w) => w.toLowerCase());
  const maxR = Math.max(...points.map((p) => p.radius));
  const box = {
    s: Math.min(...points.map((p) => p.lat)) - maxR / 111_320,
    n: Math.max(...points.map((p) => p.lat)) + maxR / 111_320,
    w: Math.min(...points.map((p) => p.lon)) - maxR / 84_000,
    e: Math.max(...points.map((p) => p.lon)) + maxR / 84_000,
  };
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const [id, name, lat, lon, category, kindTag, cuisine, hours, website, address] of rows) {
    if (category !== intent.category || lat < box.s || lat > box.n || lon < box.w || lon > box.e) continue;
    if (words.length && !words.some((w) => (cuisine ?? "").includes(w) || name.toLowerCase().includes(w))) continue;
    const at = { lat, lon };
    const inside = points.some((p) => haversine(at, p) <= p.radius);
    if (!inside) continue;
    const dedupe = `${name.toLowerCase()}@${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      id: `osm-${id}`,
      name,
      lat,
      lon,
      category,
      kind: osmKind(category, kindTag && !/^(yes|no)$/.test(kindTag) ? { leisure: kindTag } : {}, cuisine),
      cuisine,
      rating: null,
      reviews: null,
      price: null,
      hours: parseOsmHours(hours),
      address,
      website,
      source: "openstreetmap",
      meters: Math.round(nearest(at, points)),
    });
  }
  return out;
}

// --- OpenStreetMap, live ------------------------------------------------------------

/** The main Overpass server, then a mirror: the public servers rate-limit bursts. */
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const osmCache = new Map<string, { at: number; value: Candidate[] }>();

function osmKind(category: Category, tags: Record<string, string>, cuisine: string | null): string {
  if (cuisine && CATEGORY[category].food) {
    const Cuisine = cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
    // "Coffee shop", not "Coffee shop café".
    if (/coffee|cafe|café|tea|bakery|ice cream|donut/.test(cuisine)) return Cuisine;
    return `${Cuisine} ${category === "cafe" ? "café" : tags.amenity === "fast_food" ? "spot" : "restaurant"}`;
  }
  const specific = tags.leisure ?? tags.tourism ?? tags.shop ?? tags.amenity ?? tags.historic;
  const pretty = specific ? specific.replace(/_/g, " ") : CATEGORY[category].label;
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

/**
 * Named places of one category around the search points, from OpenStreetMap.
 * A cuisine or keyword narrows by the cuisine tag or the name. No ratings or
 * prices: OSM doesn't carry them, and the results say so.
 */
export async function searchOsm(points: SearchPoint[], intent: Intent): Promise<Candidate[]> {
  const def = CATEGORY[intent.category];
  const words = [intent.cuisine, ...intent.keywords].filter((w): w is string => Boolean(w)).map((w) => escapeRegex(w.toLowerCase()));
  const narrow = words.length ? [`["cuisine"~"${words.join("|")}",i]`, `["name"~"${words.join("|")}",i]`] : [""];
  // One "around" per radius, over all its points as a line: Overpass reads several
  // coordinates as a path, so "along the trip" is one light query, not one per stop.
  const byRadius = new Map<number, SearchPoint[]>();
  for (const p of points) byRadius.set(Math.round(p.radius), [...(byRadius.get(Math.round(p.radius)) ?? []), p]);
  const arounds = [...byRadius].map(([r, ps]) => `around:${r},${ps.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(",")}`);
  const clauses = arounds.flatMap((a) => def.osm.flatMap((f) => narrow.map((n) => `nwr(${a})${f}["name"]${n};`)));
  const query = `[out:json][timeout:12];(${clauses.join("")});out center 300;`;
  const hit = osmCache.get(query);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.value;

  let res: Response | null = null;
  for (const server of OVERPASS) {
    try {
      res = await fetch(server, {
        method: "POST",
        headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) break;
      console.error("[discover] Overpass", server, res.status);
    } catch (error) {
      console.error("[discover] Overpass", server, error instanceof Error ? error.message : error);
      res = null;
    }
  }
  if (!res?.ok) throw new Error(`Overpass unavailable (${res?.status ?? "no response"})`);
  const body = (await res.json()) as { elements: { type: string; id: number; lat?: number; lon?: number; center?: LatLon; tags?: Record<string, string> }[] };
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const el of body.elements) {
    const tags = el.tags ?? {};
    const at = el.center ?? (el.lat !== undefined && el.lon !== undefined ? { lat: el.lat, lon: el.lon } : null);
    if (!at || !tags.name) continue;
    // One entry per name and block: chains and multi-part buildings repeat.
    const dedupe = `${tags.name.toLowerCase()}@${at.lat.toFixed(3)},${at.lon.toFixed(3)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const cuisine = tags.cuisine?.split(";")[0].trim().replace(/_/g, " ") || null;
    out.push({
      id: `osm-${el.type[0]}${el.id}`,
      name: tags.name,
      lat: at.lat,
      lon: at.lon,
      category: intent.category,
      kind: osmKind(intent.category, tags, cuisine),
      cuisine,
      rating: null,
      reviews: null,
      price: null,
      hours: parseOsmHours(tags.opening_hours),
      address: [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") || null,
      website: tags.website ?? tags["contact:website"] ?? null,
      source: "openstreetmap",
      meters: Math.round(nearest(at, points)),
    });
  }
  osmCache.set(query, { at: Date.now(), value: out });
  return out;
}

// --- Google Places --------------------------------------------------------------

const PRICE: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};
let googleOffUntil = 0;

/**
 * A text search inside the box around the search points, with ratings, review
 * counts, price level and hours. Returns null when Google isn't available (no
 * key, API not enabled, over the cap), so the caller falls back to OSM.
 */
export async function searchGoogle(points: SearchPoint[], intent: Intent): Promise<Candidate[] | null> {
  const key = googlePlacesKey();
  if (!key || Date.now() < googleOffUntil) return null;
  if (!(await reserve("search"))) return null;
  const pad = (m: number) => m / 111_320;
  const lats = points.flatMap((p) => [p.lat - pad(p.radius), p.lat + pad(p.radius)]);
  const lons = points.flatMap((p) => [p.lon - pad(p.radius) / Math.cos((p.lat * Math.PI) / 180), p.lon + pad(p.radius) / Math.cos((p.lat * Math.PI) / 180)]);
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.location",
          "places.rating",
          "places.userRatingCount",
          "places.priceLevel",
          "places.primaryTypeDisplayName",
          "places.regularOpeningHours.periods",
          "places.shortFormattedAddress",
          "places.websiteUri",
          "places.businessStatus",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery: `${intent.searchText} in New York, NY`,
        maxResultCount: 20,
        ...(CATEGORY[intent.category].google && !intent.cuisine && !intent.keywords.length ? { includedType: CATEGORY[intent.category].google } : {}),
        ...(intent.minRating ? { minRating: intent.minRating } : {}),
        locationRestriction: {
          rectangle: {
            low: { latitude: Math.min(...lats), longitude: Math.min(...lons) },
            high: { latitude: Math.max(...lats), longitude: Math.max(...lons) },
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 403 || res.status === 400) {
      release("search");
      googleOffUntil = Date.now() + 2 * 60 * 1000;
      console.error("[discover] Google Places unavailable:", (await res.text()).slice(0, 160));
      return null;
    }
    if (!res.ok) return null;
    const body = (await res.json()) as {
      places?: {
        id: string;
        displayName?: { text: string };
        location: { latitude: number; longitude: number };
        rating?: number;
        userRatingCount?: number;
        priceLevel?: string;
        primaryTypeDisplayName?: { text: string };
        regularOpeningHours?: { periods?: { open: { day: number; hour: number; minute?: number }; close?: { day: number; hour: number; minute?: number } }[] };
        shortFormattedAddress?: string;
        websiteUri?: string;
        businessStatus?: string;
      }[];
    };
    return (body.places ?? [])
      .filter((p) => p.displayName?.text && p.businessStatus !== "CLOSED_PERMANENTLY" && p.businessStatus !== "CLOSED_TEMPORARILY")
      .map((p) => {
        const at = { lat: p.location.latitude, lon: p.location.longitude };
        return {
          id: `g-${p.id}`,
          name: p.displayName!.text,
          ...at,
          category: intent.category,
          kind: p.primaryTypeDisplayName?.text ?? CATEGORY[intent.category].label,
          // Only when Google's own type or the name says so: the search words aren't evidence.
          cuisine: intent.cuisine && `${p.primaryTypeDisplayName?.text ?? ""} ${p.displayName!.text}`.toLowerCase().includes(intent.cuisine) ? intent.cuisine : null,
          rating: p.rating ?? null,
          reviews: p.userRatingCount ?? null,
          price: p.priceLevel ? (PRICE[p.priceLevel] ?? null) : null,
          hours: googleHours(p.regularOpeningHours?.periods),
          address: p.shortFormattedAddress ?? null,
          website: p.websiteUri ?? null,
          source: "google" as const,
          meters: Math.round(nearest(at, points)),
        };
      });
  } catch (error) {
    console.error("[discover] Google search failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
