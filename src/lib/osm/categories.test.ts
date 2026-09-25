import { describe, expect, it } from "vitest";
import { categorize, dedupe, normalizeCuisine, summarize, toPlaces } from "./categories";
import { estimateWalkMin, haversine, inNycArea, parseLatLon } from "./geo";
import { CENTER, ELEMENTS, place } from "./__fixtures__";

describe("categorize", () => {
  it("maps OSM tags to app categories", () => {
    expect(categorize({ shop: "supermarket" })).toBe("groceries");
    expect(categorize({ shop: "greengrocer" })).toBe("groceries");
    expect(categorize({ amenity: "fast_food" })).toBe("restaurants");
    expect(categorize({ amenity: "cafe" })).toBe("coffee");
    expect(categorize({ amenity: "pub" })).toBe("nightlife");
    expect(categorize({ leisure: "fitness_centre" })).toBe("fitness");
    expect(categorize({ leisure: "playground" })).toBe("parks");
    expect(categorize({ railway: "station", station: "subway" })).toBe("subway");
    expect(categorize({ highway: "bus_stop" })).toBe("bus");
    expect(categorize({ tourism: "museum" })).toBe("entertainment");
  });

  it("ignores tags we do not summarize", () => {
    expect(categorize({ office: "company" })).toBeNull();
    expect(categorize({})).toBeNull();
  });
});

describe("normalizeCuisine", () => {
  it("buckets multi-valued and regional cuisines", () => {
    expect(normalizeCuisine("indian;pakistani")).toBe("indian");
    expect(normalizeCuisine("Sushi")).toBe("japanese");
    expect(normalizeCuisine("jamaican")).toBe("caribbean");
    expect(normalizeCuisine("coffee_shop;pizza")).toBe("pizza");
  });

  it("returns null for unknown or missing cuisines", () => {
    expect(normalizeCuisine(undefined)).toBeNull();
    expect(normalizeCuisine("regional")).toBeNull();
  });
});

describe("toPlaces", () => {
  const places = toPlaces(ELEMENTS, CENTER);

  it("keeps way centers, drops unnamed non-bus places and unknown tags", () => {
    const names = places.map((p) => p.name);
    expect(names).toContain("Food Bazaar");
    expect(names).toContain("Bus stop");
    expect(names).not.toContain("Some Office");
    // The unnamed pizza place cannot be shown to anyone.
    expect(places.filter((p) => p.category === "restaurants")).toHaveLength(3);
  });

  it("dedupes a station mapped twice", () => {
    expect(places.filter((p) => p.name === "Euclid Avenue")).toHaveLength(1);
  });

  it("sorts nearest first and marks walk times as estimates", () => {
    const meters = places.map((p) => p.meters);
    expect(meters).toEqual([...meters].sort((a, b) => a - b));
    expect(places.every((p) => p.estimated)).toBe(true);
  });

  it("tags restaurants with a cuisine bucket", () => {
    expect(places.find((p) => p.name === "Taj Mahal")?.cuisine).toBe("indian");
    expect(places.find((p) => p.name === "Food Bazaar")?.cuisine).toBeNull();
  });
});

describe("dedupe", () => {
  it("keeps same-named places that are far apart", () => {
    const a = place({ id: "a", name: "Key Food", category: "groceries" });
    const b = place({ id: "b", name: "Key Food", category: "groceries", lat: CENTER.lat + 0.01 });
    expect(dedupe([a, b])).toHaveLength(2);
  });
});

describe("summarize", () => {
  it("counts by walk band and reports cuisines within 15 minutes", () => {
    const summary = summarize([
      place({ id: "r1", category: "restaurants", cuisine: "indian", walkMin: 3 }),
      place({ id: "r2", category: "restaurants", cuisine: "indian", walkMin: 12 }),
      place({ id: "r3", category: "restaurants", cuisine: "thai", walkMin: 18 }),
    ]);
    const food = summary.find((s) => s.id === "restaurants")!;
    expect([food.within5, food.within10, food.within15]).toEqual([1, 1, 2]);
    expect(food.cuisines).toEqual([{ cuisine: "indian", count: 2 }]);
    expect(summary.find((s) => s.id === "coffee")?.within15).toBe(0);
  });

  it("orders the nearest few by routed walk time", () => {
    const summary = summarize([
      place({ id: "near-but-slow", category: "parks", meters: 100, walkMin: 9 }),
      place({ id: "far-but-fast", category: "parks", meters: 300, walkMin: 4 }),
    ]);
    expect(summary.find((s) => s.id === "parks")?.nearest.map((p) => p.id)).toEqual(["far-but-fast", "near-but-slow"]);
  });
});

describe("geo", () => {
  it("measures distance", () => {
    expect(Math.round(haversine({ lat: 40.758, lon: -73.9855 }, { lat: 40.7527, lon: -73.9772 }))).toBeGreaterThan(850);
    expect(estimateWalkMin(0)).toBe(1);
    expect(estimateWalkMin(800)).toBe(13);
  });

  it("only accepts NYC-area coordinates", () => {
    expect(inNycArea(CENTER)).toBe(true);
    expect(inNycArea({ lat: 34.05, lon: -118.24 })).toBe(false);
    expect(parseLatLon(new URLSearchParams("lat=40.67&lon=-73.86"))).toEqual({ lat: 40.67, lon: -73.86 });
    expect(parseLatLon(new URLSearchParams("lat=abc&lon=-73.86"))).toBeNull();
  });
});

describe("place details", () => {
  it("carries hours, phone, street and safe websites from OSM tags", () => {
    const [cafe] = toPlaces(
      [
        {
          type: "node",
          id: 99,
          lat: CENTER.lat,
          lon: CENTER.lon,
          tags: {
            name: "Bean",
            amenity: "cafe",
            opening_hours: "Mo-Fr 07:00-19:00",
            "contact:phone": "+1 718 555 0100",
            "addr:housenumber": "12",
            "addr:street": "Linden Boulevard",
            website: "https://bean.example",
          },
        },
      ],
      CENTER,
    );
    expect(cafe).toMatchObject({
      hours: "Mo-Fr 07:00-19:00",
      phone: "+1 718 555 0100",
      street: "12 Linden Boulevard",
      website: "https://bean.example",
    });
  });

  it("drops websites that are not http(s) links", () => {
    const [p] = toPlaces(
      [{ type: "node", id: 1, lat: CENTER.lat, lon: CENTER.lon, tags: { name: "X", amenity: "cafe", website: "javascript:alert(1)" } }],
      CENTER,
    );
    expect(p.website).toBeUndefined();
    expect(p.hours).toBeUndefined();
  });
});
