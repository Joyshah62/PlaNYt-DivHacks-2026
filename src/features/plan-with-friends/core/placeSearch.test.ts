import { describe, expect, it } from "vitest";
import { createPlaceIndex, normalize, type CatalogPlace, type PoiRow } from "./placeSearch";

const catalog: CatalogPlace[] = [
  { id: "met", name: "The Met", area: "Upper East Side", visitMin: 150, lat: 40.7794, lon: -73.9632 },
  { id: "central-park", name: "Central Park", area: "Bethesda Terrace", visitMin: 90, lat: 40.774, lon: -73.971 },
];
const rows: PoiRow[] = [
  ["n1", "Bungalow", 40.72365, -73.98795, "restaurant", "restaurant", "indian", "Tu-Su 17:00-22:30", null, "24 1st Avenue"],
  ["n2", "Levain Bakery", 40.7799, -73.98034, "dessert", "bakery", null, null, null, "167 West 74th Street"],
  ["n3", "Levain Bakery", 40.71576, -73.95912, "dessert", "bakery", null, null, null, "164 North 4th Street"],
  ["n4", "Joe's Pizza", 40.7305, -74.002, "restaurant", "fast_food", "pizza", null, null, "7 Carmine Street"],
  ["n5", "Metropolitan Diner", 40.7, -73.99, "restaurant", "restaurant", "diner", null, null, null],
  ["n6", "Café Mogador", 40.727, -73.984, "cafe", "cafe", null, null, null, "101 St Marks Place"],
  ["n7", "Central Park", 40.7741, -73.9712, "park", "park", null, null, null, null],
  ["n8", "Central Park", 40.6, -74.1, "park", "park", null, null, null, "Staten Island"],
];
const labels = { restaurant: { label: "Restaurant", visitMin: 60 }, dessert: { label: "Dessert", visitMin: 30 }, cafe: { label: "Café", visitMin: 40 } };
const index = createPlaceIndex(catalog, rows, (c) => labels[c as keyof typeof labels] ?? { label: "Place", visitMin: 60 }, () => "near Astor Pl");

describe("normalize", () => {
  it("folds case, accents, apostrophes and ampersands", () => {
    expect(normalize("Joe’s  Café & Bar")).toBe("joes cafe and bar");
  });
});

describe("place search", () => {
  it("finds a place by name and describes it", () => {
    const [hit] = index.search("bungalow");
    expect(hit).toMatchObject({ name: "Bungalow", detail: "Indian restaurant · 24 1st Avenue", source: "osm", visitMin: 60 });
    expect(hit.hoursText).toBe("Tu-Su 17:00-22:30");
  });

  it("lists every branch so you can pick the right one", () => {
    const hits = index.search("levain");
    expect(hits.map((h) => h.detail)).toEqual(["Dessert · 167 West 74th Street", "Dessert · 164 North 4th Street"]);
    expect(new Set(hits.map((h) => h.key)).size).toBe(2);
  });

  it("ignores apostrophes and accents in what you type", () => {
    expect(index.search("joes pizza")[0]?.name).toBe("Joe's Pizza");
    expect(index.search("cafe mog")[0]?.name).toBe("Café Mogador");
  });

  it("puts exact and catalog matches before looser ones", () => {
    const hits = index.search("met");
    expect(hits[0]).toMatchObject({ name: "The Met", source: "catalog", attractionId: "met", detail: "Upper East Side" });
    expect(hits.map((h) => h.name)).toContain("Metropolitan Diner");
  });

  it("says where a place is when there's no address", () => {
    expect(index.search("metropolitan diner")[0]?.detail).toBe("Diner restaurant · near Astor Pl");
  });

  it("drops map-data duplicates of a nearby catalog sight, but keeps far-away namesakes", () => {
    const hits = index.search("central park");
    expect(hits.map((h) => h.source)).toEqual(["catalog", "osm"]);
    expect(hits[1].detail).toContain("Staten Island");
  });

  it("matches words by prefix, in any order", () => {
    expect(index.search("pizza joe")[0]?.name).toBe("Joe's Pizza");
    expect(index.search("indian bung")[0]?.name).toBe("Bungalow");
  });

  it("returns nothing for very short or unmatched text, and respects the limit", () => {
    expect(index.search("b")).toEqual([]);
    expect(index.search("zzzz")).toEqual([]);
    expect(index.search("e", 1)).toEqual([]);
    expect(index.search("levain", 1)).toHaveLength(1);
  });
});
