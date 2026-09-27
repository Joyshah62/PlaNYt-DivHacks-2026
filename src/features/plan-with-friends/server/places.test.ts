import { describe, expect, it } from "vitest";
import { searchPlaces } from "./places";

describe("place search over the bundled NYC data", () => {
  it("finds Bungalow with its address and opening hours", async () => {
    const [hit] = await searchPlaces("bungalow");
    expect(hit).toMatchObject({ name: "Bungalow", source: "osm" });
    expect(hit.detail).toContain("1st Avenue");
    expect(hit.stop.hours?.length).toBe(7);
  });

  it("lists several Levain Bakery branches", async () => {
    const hits = await searchPlaces("levain");
    expect(hits.length).toBeGreaterThanOrEqual(5);
    expect(hits.every((h) => h.name.startsWith("Levain"))).toBe(true);
  });

  it("includes subway stations only when picking a starting point", async () => {
    expect((await searchPlaces("astor pl", 8, true)).some((h) => h.detail.startsWith("Subway station"))).toBe(true);
    expect((await searchPlaces("astor pl")).some((h) => h.detail.startsWith("Subway station"))).toBe(false);
  });

  it("returns catalog sights as ready-to-plan stops", async () => {
    const [hit] = await searchPlaces("the met");
    expect(hit.stop).toMatchObject({ key: "met", attractionId: "met" });
  });
});
