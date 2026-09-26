// Builds src/lib/plan/photo-data.json: one freely licensed photo per catalog
// place, from each place's Wikipedia article, with the credit and license the
// license requires us to show.
//
//   node scripts/build-photo-data.mjs
//
// Batched (one request per 50 titles) to stay well inside Wikipedia's limits.
// This is the fallback when Google Places photos are off or over their cap.

import { writeFile } from "node:fs/promises";

const OUT = new URL("../src/lib/plan/photo-data.json", import.meta.url);
const API = "https://en.wikipedia.org/w/api.php";
const HEADERS = { "User-Agent": "RoamNYC/0.1 (DivHacks 2026 project; NYC day planner)" };

/** Catalog id -> article titles to try, best first. */
const TITLES = {
  met: ["Metropolitan Museum of Art"],
  moma: ["Museum of Modern Art"],
  amnh: ["American Museum of Natural History"],
  guggenheim: ["Solomon R. Guggenheim Museum"],
  whitney: ["Whitney Museum of American Art"],
  "911-museum": ["National September 11 Memorial & Museum"],
  tenement: ["Tenement Museum", "97 Orchard Street", "Lower East Side"],
  intrepid: ["Intrepid Museum"],
  "brooklyn-museum": ["Brooklyn Museum"],
  cloisters: ["The Cloisters"],
  "top-of-the-rock": ["30 Rockefeller Plaza"],
  "empire-state": ["Empire State Building"],
  summit: ["One Vanderbilt"],
  edge: ["30 Hudson Yards", "Hudson Yards, Manhattan"],
  "one-world": ["One World Trade Center"],
  "statue-of-liberty": ["Statue of Liberty"],
  "staten-island-ferry": ["Staten Island Ferry"],
  "brooklyn-bridge": ["Brooklyn Bridge"],
  "times-square": ["Times Square"],
  "grand-central": ["Grand Central Terminal"],
  "st-patricks": ["St. Patrick's Cathedral (Manhattan)"],
  "wall-street": ["Charging Bull", "Wall Street"],
  "roosevelt-tram": ["Roosevelt Island Tramway"],
  vessel: ["Vessel (structure)"],
  "central-park": ["Central Park"],
  "high-line": ["High Line"],
  "little-island": ["Little Island at Pier 55", "Little Island (New York City)"],
  "brooklyn-bridge-park": ["Brooklyn Bridge Park"],
  "washington-square": ["Washington Square Park"],
  "bryant-park": ["Bryant Park"],
  "prospect-park": ["Prospect Park (Brooklyn)"],
  "botanic-garden": ["Brooklyn Botanic Garden"],
  "domino-park": ["Domino Park", "Domino Sugar Refinery"],
  "chelsea-market": ["Chelsea Market"],
  katz: ["Katz's Delicatessen"],
  chinatown: ["Chinatown, Manhattan"],
  flushing: ["Flushing, Queens"],
  soho: ["SoHo, Manhattan"],
  "little-italy": ["Little Italy, Manhattan"],
  dumbo: ["Dumbo, Brooklyn"],
  williamsburg: ["Williamsburg, Brooklyn"],
  harlem: ["Apollo Theater", "Harlem"],
  "coney-island": ["Coney Island"],
  "west-village": ["West Village"],
};

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params })}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
    if (res.ok) return res.json();
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error(`Wikipedia query failed: ${url}`);
}

const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const strip = (html = "") => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// 1. Each article's lead image file.
const allTitles = [...new Set(Object.values(TITLES).flat())];
const fileOf = new Map();
for (const batch of chunks(allTitles, 50)) {
  const json = await api({ action: "query", titles: batch.join("|"), prop: "pageimages", piprop: "name", redirects: "1" });
  const alias = new Map();
  for (const r of [...(json.query.normalized ?? []), ...(json.query.redirects ?? [])]) alias.set(r.to, r.from);
  for (const page of json.query.pages) {
    if (!page.pageimage) continue;
    // Walk back through redirects/normalization to the title we asked for.
    let title = page.title;
    const seen = new Set();
    while (alias.has(title) && !seen.has(title)) {
      seen.add(title);
      title = alias.get(title);
    }
    fileOf.set(title, { file: page.pageimage, article: page.title });
  }
}

// 2. A sized URL plus author and license for each file.
const files = [...new Set([...fileOf.values()].map((f) => f.file))];
const infoOf = new Map();
for (const batch of chunks(files, 50)) {
  const json = await api({
    action: "query",
    titles: batch.map((f) => `File:${f}`).join("|"),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "960",
  });
  const alias = new Map((json.query.normalized ?? []).map((r) => [r.to, r.from]));
  for (const page of json.query.pages) {
    const ii = page.imageinfo?.[0];
    if (!ii) continue;
    const asked = (alias.get(page.title) ?? page.title).replace(/^File:/, "");
    const meta = ii.extmetadata ?? {};
    infoOf.set(asked, {
      url: ii.thumburl ?? ii.url,
      credit: strip(meta.Artist?.value) || "Wikimedia Commons",
      license: strip(meta.LicenseShortName?.value) || "",
      source: ii.descriptionurl,
    });
  }
}

const photos = {};
for (const [id, titles] of Object.entries(TITLES)) {
  for (const t of titles) {
    const f = fileOf.get(t);
    const info = f && infoOf.get(f.file);
    if (info) {
      photos[id] = { ...info, article: f.article };
      break;
    }
  }
  if (!photos[id]) console.warn(`no photo for ${id}`);
}

await writeFile(OUT, JSON.stringify(photos, null, 1) + "\n");
console.log(`wrote ${Object.keys(photos).length}/${Object.keys(TITLES).length} photos`);
