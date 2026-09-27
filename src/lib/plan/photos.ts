import { release, reserve, usageReport } from "@/lib/google/quota";
import { haversine } from "@/lib/osm/geo";
import { USER_AGENT } from "@/lib/osm/userAgent";
import type { LatLon } from "@/lib/osm/types";
import wikiPhotos from "./photo-data.json";

/**
 * One photo per place. Google Places photos come first when a key is set, but
 * behind a hard cap so the project stays inside Google's free monthly usage;
 * past the cap (or without a key) the photo comes from Wikipedia instead.
 *
 * Each Google lookup is two billable calls on two SKUs: a Text Search that
 * returns the place's photo references (Text Search Pro), then the sized image
 * (Place Details Photos). Both count against the "photos" budget in
 * lib/google/quota.ts, which keeps them inside Google's free monthly usage.
 */

export interface Photo {
  url: string;
  credit: string;
  creditUrl: string | null;
  license: string | null;
  source: "google" | "wikipedia";
}

const KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
/** Photo URLs are short-lived; hold them only long enough to spare repeat views a charge. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
// A quota pause or network failure must not hide a photo for six hours.
const MISS_TTL_MS = 60 * 1000;

/** The server-side key, shared with discovery; never sent to the browser. */
export const googlePlacesKey = () => KEY;

export async function googleUsage() {
  return { enabled: Boolean(KEY), skus: await usageReport() };
}

// --- Google Places ------------------------------------------------------------

/** After a permission error (API not enabled, key restricted), stop asking for a while. */
let googleOffUntil = 0;

async function googlePhoto(name: string, near: LatLon): Promise<Photo | null> {
  if (!KEY || Date.now() < googleOffUntil) return null;
  if (!(await reserve("photos"))) return null;
  try {
    const search = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY,
        // Only what we show: every extra field can move the call to a pricier SKU.
        "X-Goog-FieldMask": "places.photos.name,places.photos.authorAttributions",
      },
      body: JSON.stringify({
        textQuery: `${name}, New York, NY`,
        maxResultCount: 1,
        locationBias: { circle: { center: { latitude: near.lat, longitude: near.lon }, radius: 500 } },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (search.status === 403) {
      release("photos");
      googleOffUntil = Date.now() + 2 * 60 * 1000;
      console.error("[photos] Google Places refused the key:", (await search.text()).slice(0, 200));
      return null;
    }
    if (!search.ok) return null;
    const body = (await search.json()) as {
      places?: { photos?: { name: string; authorAttributions?: { displayName?: string; uri?: string }[] }[] }[];
    };
    const photo = body.places?.[0]?.photos?.[0];
    if (!photo) return null;

    const media = await fetch(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=960&skipHttpRedirect=true&key=${KEY}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!media.ok) return null;
    const { photoUri } = (await media.json()) as { photoUri?: string };
    if (!photoUri) return null;
    const author = photo.authorAttributions?.[0];
    return { url: photoUri, credit: author?.displayName ?? "Google Maps", creditUrl: author?.uri ?? null, license: null, source: "google" };
  } catch (error) {
    console.error("[photos] Google lookup failed", error instanceof Error ? error.message : error);
    return null;
  }
}

// --- Wikipedia ----------------------------------------------------------------

type WikiEntry = { url: string; credit: string; license: string; source: string; article: string };
const WIKI = wikiPhotos as Record<string, WikiEntry>;

function fromWiki(e: WikiEntry): Photo {
  return { url: e.url, credit: e.credit, creditUrl: e.source, license: e.license || null, source: "wikipedia" };
}

/** For places outside the catalog: an article with a photo, only if it is really at this spot. */
async function wikipediaNear(name: string, near: LatLon): Promise<Photo | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `${name} New York`,
    gsrlimit: "5",
    prop: "pageimages|coordinates",
    piprop: "thumbnail|name",
    pithumbsize: "960",
  });
  try {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: { pages?: { title: string; index: number; thumbnail?: { source: string }; pageimage?: string; coordinates?: { lat: number; lon: number }[] }[] };
    };
    const hit = (json.query?.pages ?? [])
      .sort((a, b) => a.index - b.index)
      .find((p) => p.thumbnail && p.coordinates?.[0] && haversine(near, p.coordinates[0]) < 400);
    if (!hit?.thumbnail) return null;
    return {
      url: hit.thumbnail.source,
      credit: "Wikimedia Commons",
      creditUrl: hit.pageimage ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(hit.pageimage)}` : null,
      license: null,
      source: "wikipedia",
    };
  } catch {
    return null;
  }
}

// --- entry point --------------------------------------------------------------

const cache = new Map<string, { photo: Photo | null; at: number }>();
const pending = new Map<string, Promise<Photo | null>>();

export async function photoFor(place: { attractionId: string | null; name: string } & LatLon): Promise<Photo | null> {
  const key = place.attractionId ?? `${place.name.toLowerCase()}|${place.lat.toFixed(4)},${place.lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.photo ? CACHE_TTL_MS : MISS_TTL_MS)) return hit.photo;
  // Two viewers opening the same place at once share one lookup (and one charge).
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const work = (async () => {
    const wiki = place.attractionId ? WIKI[place.attractionId] : undefined;
    const photo = (await googlePhoto(place.name, place)) ?? (wiki ? fromWiki(wiki) : await wikipediaNear(place.name, place));
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    cache.set(key, { photo, at: Date.now() });
    return photo;
  })();
  pending.set(key, work);
  try {
    return await work;
  } finally {
    pending.delete(key);
  }
}
