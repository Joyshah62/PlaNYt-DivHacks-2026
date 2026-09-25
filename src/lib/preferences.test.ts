import { describe, expect, it } from "vitest";
import { computeMatch, decodePreferences, encodePreferences, lifestyleHighlights } from "./preferences";
import { commute, nearby, place } from "./osm/__fixtures__";

describe("preference URLs", () => {
  it("round-trips preferences and destinations", () => {
    const prefs = {
      prefs: ["indian" as const, "fitness" as const],
      destinations: [
        { kind: "work" as const, text: "1 Pierrepont Plaza" },
        { kind: "school" as const, text: "Columbia University" },
      ],
    };
    const params = encodePreferences(prefs);
    expect(params.get("p")).toBe("indian,fitness");
    expect(decodePreferences({ p: params.get("p"), to: params.get("to") })).toEqual(prefs);
  });

  it("drops unknown ids, duplicates and malformed destinations", () => {
    expect(
      decodePreferences({ p: "indian,bogus,indian", to: "work:ok place|x|spaceship:Mars base|" }),
    ).toEqual({
      prefs: ["indian"],
      destinations: [{ kind: "work", text: "ok place" }],
    });
  });

  it("treats a destination without a kind as other and caps the list", () => {
    const decoded = decodePreferences({ to: "Barclays Center|a:1|b:2|c:3" });
    expect(decoded.destinations[0]).toEqual({ kind: "other", text: "Barclays Center" });
    expect(decodePreferences({ to: "aa|bb|cc|dd" }).destinations).toHaveLength(3);
  });

  it("handles missing params", () => {
    expect(decodePreferences({})).toEqual({ prefs: [], destinations: [] });
  });
});

describe("lifestyleHighlights", () => {
  const places = [
    place({ id: "taj", name: "Taj", category: "restaurants", cuisine: "indian", walkMin: 3 }),
    place({ id: "far-indian", name: "Far Indian", category: "restaurants", cuisine: "indian", walkMin: 18 }),
    place({ id: "wok", name: "Wok", category: "restaurants", cuisine: "chinese", walkMin: 6 }),
    place({ id: "euclid", name: "Euclid Av", category: "subway", walkMin: 7 }),
    place({ id: "bus1", name: "Bus stop", category: "bus", walkMin: 2 }),
    place({ id: "tap", name: "Corner Tap", category: "nightlife", walkMin: 4, estimated: true }),
  ];

  it("counts cuisine-specific places within 15 minutes and names the nearest", () => {
    const [indian] = lifestyleHighlights(["indian"], nearby(places), null);
    expect(indian).toMatchObject({ value: 1, unit: "count", caption: "Indian restaurants within a 15-min walk" });
    expect(indian.detail).toBe("Nearest: Taj · 3 min walk");
    expect(indian.placeIds).toEqual(["taj"]);
  });

  it("reports transit as minutes to the nearest station", () => {
    const [transit] = lifestyleHighlights(["transit"], nearby(places), null);
    expect(transit).toMatchObject({ value: 7, unit: "minutes", caption: "walk to Euclid Av" });
    expect(transit.detail).toBe("1 bus stop within a 5-min walk");
  });

  it("reports quiet as late-night venues on the immediate blocks", () => {
    const [quiet] = lifestyleHighlights(["quiet"], nearby(places), null);
    expect(quiet.value).toBe(1);
    expect(quiet.detail).toBe("Closest: Corner Tap · ~4 min walk");
  });

  it("says a category is empty rather than hiding it", () => {
    const [gyms] = lifestyleHighlights(["fitness"], nearby(places), null);
    expect(gyms.value).toBe(0);
    expect(gyms.detail).toBe("None found within 1,200 m");
  });

  it("never turns a failed lookup into a zero", () => {
    const [gyms] = lifestyleHighlights(["fitness"], nearby([], false), null);
    expect(gyms.value).toBeNull();
  });

  it("prefers the reader's own destination for commute", () => {
    const report = commute([
      { id: "c", label: "Columbia University", kind: "school", lat: 0, lon: 0, walkMin: null, driveMin: 36, driveMiles: 14.9, estimated: false },
      { id: "ts", label: "Times Square", kind: "preset", lat: 0, lon: 0, walkMin: null, driveMin: 28, driveMiles: 11.4, estimated: false },
    ]);
    const [c] = lifestyleHighlights(["commute"], null, report);
    expect(c).toMatchObject({ value: 36, unit: "minutes", caption: "drive to Columbia University" });
  });

  it("leaves the match score undecided", () => {
    expect(computeMatch({ prefs: [], nearby: null, commute: null, building: null })).toBeNull();
  });
});
