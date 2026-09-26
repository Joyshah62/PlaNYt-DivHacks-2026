// Builds src/lib/discover/poi-data.json: named places to eat, drink, see and do
// across the five boroughs, from OpenStreetMap, for "find something that fits my
// trip". Searching a local copy is instant and never rate-limited; the live
// Overpass API stays as the fallback.
//
//   node scripts/build-poi-data.mjs
//
// The city is fetched in tiles (one heavy query for all of NYC times out on the
// public servers), each with retries across mirrors. Data © OpenStreetMap
// contributors, ODbL.

import { writeFile } from "node:fs/promises";

const OUT = new URL("../src/lib/discover/poi-data.json", import.meta.url);
const SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const UA = "RoamNYC/0.1 (DivHacks 2026 project; NYC day planner) data build";

/** Five-borough box, split into a grid. Dense Manhattan tiles stay small. */
const SOUTH = 40.49, WEST = -74.26, NORTH = 40.92, EAST = -73.7;
const ROWS = 6, COLS = 5;

const FILTERS = [
  '["amenity"~"^(restaurant|fast_food|cafe|bar|pub|ice_cream|cinema|planetarium)$"]',
  '["shop"~"^(bakery|pastry|confectionery|chocolate|clothes|books|gift|department_store|mall|boutique|shoes|jewelry|music|antiques|second_hand|art)$"]',
  '["tourism"~"^(museum|gallery|viewpoint|attraction|zoo|aquarium|theme_park)$"]',
  '["leisure"~"^(park|garden|bowling_alley|amusement_arcade|escape_game|miniature_golf|ice_rink|trampoline_park)$"]',
  '["historic"~"^(monument|memorial)$"]',
];

/** The discovery category a place belongs to, from its tags (same mapping as categories.ts). */
function categoryOf(t) {
  const a = t.amenity, s = t.shop, to = t.tourism, l = t.leisure;
  if (a === "restaurant" || a === "fast_food") return "restaurant";
  if (a === "cafe") return "cafe";
  if (a === "bar" || a === "pub") return "bar";
  if (a === "ice_cream" || ["bakery", "pastry", "confectionery", "chocolate"].includes(s)) return "dessert";
  if (to === "museum") return "museum";
  if (to === "gallery" || s === "art") return "gallery";
  if (l === "park" || l === "garden") return "park";
  if (to === "viewpoint") return "viewpoint";
  if (s) return "shopping";
  if (["bowling_alley", "amusement_arcade", "escape_game", "miniature_golf", "ice_rink", "trampoline_park"].includes(l) || ["zoo", "aquarium", "theme_park"].includes(to) || a === "planetarium") return "activity";
  if (to === "attraction" || t.historic) return "landmark";
  return null;
}

async function overpass(query) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const server = SERVERS[attempt % SERVERS.length];
    try {
      const res = await fetch(server, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(180_000),
      });
      if (res.ok) return res.json();
      console.warn(`  ${server} ${res.status}, retrying`);
    } catch (error) {
      console.warn(`  ${server} ${error.message}, retrying`);
    }
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
  }
  throw new Error("Overpass kept failing");
}

const round = (n) => Math.round(n * 1e5) / 1e5;
const places = new Map();
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const s = SOUTH + ((NORTH - SOUTH) * r) / ROWS, n = SOUTH + ((NORTH - SOUTH) * (r + 1)) / ROWS;
    const w = WEST + ((EAST - WEST) * c) / COLS, e = WEST + ((EAST - WEST) * (c + 1)) / COLS;
    const bbox = `${s},${w},${n},${e}`;
    const body = await overpass(`[out:json][timeout:170];(${FILTERS.map((f) => `nwr(${bbox})${f}["name"];`).join("")});out center tags;`);
    let added = 0;
    for (const el of body.elements) {
      const t = el.tags ?? {};
      const at = el.center ?? (el.lat !== undefined ? { lat: el.lat, lon: el.lon } : null);
      const cat = categoryOf(t);
      if (!at || !t.name || !cat) continue;
      const id = `${el.type[0]}${el.id}`;
      if (places.has(id)) continue;
      const kind = t.amenity ?? t.shop ?? t.tourism ?? t.leisure ?? t.historic ?? null;
      const cuisine = t.cuisine ? t.cuisine.split(";")[0].trim().replace(/_/g, " ").toLowerCase() : null;
      const addr = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ") || null;
      // [id, name, lat, lon, category, kind tag, cuisine, opening_hours, website, address]
      places.set(id, [id, t.name, round(at.lat), round(at.lon), cat, kind, cuisine, t.opening_hours ?? null, t.website ?? t["contact:website"] ?? null, addr]);
      added++;
    }
    console.log(`tile ${r * COLS + c + 1}/${ROWS * COLS}: +${added} (total ${places.size})`);
  }
}

await writeFile(
  OUT,
  JSON.stringify({ source: "OpenStreetMap contributors (ODbL), via Overpass", built: new Date().toISOString().slice(0, 10), places: [...places.values()] }),
);
console.log(`wrote ${places.size} places to ${OUT.pathname}`);
