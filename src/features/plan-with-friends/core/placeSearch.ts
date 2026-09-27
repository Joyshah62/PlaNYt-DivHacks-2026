/** [id, name, lat, lon, category, kind tag, cuisine, opening_hours, website, address], as bundled for Discover. */
export type PoiRow = [string, string, number, number, string, string, string | null, string | null, string | null, string | null];

export interface CatalogPlace {
  id: string;
  name: string;
  area: string;
  visitMin: number;
  lat: number;
  lon: number;
}

export interface PlaceHit {
  key: string;
  name: string;
  lat: number;
  lon: number;
  detail: string;
  visitMin: number;
  hoursText: string | null;
  source: "catalog" | "osm" | "address";
  attractionId: string | null;
}

export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface Entry {
  hit: PlaceHit;
  norm: string;
  words: string[];
  /** Extra words that can match but rank lower: the area, or the cuisine. */
  extra: string[];
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Rough metres between two nearby points; plenty for "is this the same place?". */
const metersBetween = (aLat: number, aLon: number, bLat: number, bLon: number) =>
  Math.hypot((aLat - bLat) * 111_320, (aLon - bLon) * 111_320 * Math.cos((aLat * Math.PI) / 180));

export function createPlaceIndex(
  catalog: CatalogPlace[],
  rows: PoiRow[],
  categoryOf: (category: string) => { label: string; visitMin: number },
  /** Where a place is when the data has no address, e.g. "near Astor Pl". */
  locate: (lat: number, lon: number) => string | null = () => null,
) {
  const entries: Entry[] = [];
  for (const a of catalog) {
    const norm = normalize(a.name);
    entries.push({
      hit: { key: a.id, name: a.name, lat: a.lat, lon: a.lon, detail: a.area, visitMin: a.visitMin, hoursText: null, source: "catalog", attractionId: a.id },
      norm,
      words: norm.split(" "),
      extra: normalize(a.area).split(" "),
    });
  }
  const curated = new Map(catalog.map((a) => [normalize(a.name), a]));
  for (const [id, name, lat, lon, category, , cuisine, hours, , address] of rows) {
    const twin = curated.get(normalize(name));
    // The catalog copy has curated hours and visit length; skip the map-data duplicate.
    if (twin && metersBetween(lat, lon, twin.lat, twin.lon) < 600) continue;
    const def = categoryOf(category);
    const kind = cuisine ? `${capitalize(cuisine.split(";")[0].replace(/_/g, " "))} ${def.label.toLowerCase()}` : def.label;
    const norm = normalize(name);
    entries.push({
      hit: { key: `osm-${id}`, name, lat, lon, detail: [kind, address ?? locate(lat, lon)].filter(Boolean).join(" · "), visitMin: def.visitMin, hoursText: hours, source: "osm", attractionId: null },
      norm,
      words: norm.split(" "),
      extra: cuisine ? normalize(cuisine).split(" ") : [],
    });
  }

  function score(e: Entry, q: string, tokens: string[]): number | null {
    const inName = tokens.every((t) => e.words.some((w) => w.startsWith(t)));
    const inAny = inName || tokens.every((t) => e.words.some((w) => w.startsWith(t)) || e.extra.some((w) => w.startsWith(t)));
    if (!inAny) return null;
    let s = e.norm === q ? 0 : e.norm.startsWith(q) || e.norm.startsWith(`the ${q}`) ? 1 : inName ? 2 : 3;
    if (e.hit.source === "catalog") s -= 0.5;
    return s;
  }

  return {
    search(text: string, limit = 8): PlaceHit[] {
      const q = normalize(text);
      if (q.length < 2) return [];
      const tokens = q.split(" ");
      const found: { e: Entry; s: number }[] = [];
      for (const e of entries) {
        const s = score(e, q, tokens);
        if (s !== null) found.push({ e, s });
      }
      found.sort((a, b) => a.s - b.s || a.e.norm.length - b.e.norm.length);
      return found.slice(0, limit).map((f) => f.e.hit);
    },
  };
}
