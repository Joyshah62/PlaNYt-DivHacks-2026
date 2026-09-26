import { describe, expect, it } from "vitest";
import { formatTicker, interpolate, rangeToZoom, routePath } from "./camera";

describe("rangeToZoom", () => {
  it("maps 400 m to zoom 16 and halves the range per zoom level", () => {
    expect(rangeToZoom(400)).toBeCloseTo(16);
    expect(rangeToZoom(1600)).toBeCloseTo(14);
  });
  it("clamps to 0..20", () => {
    expect(rangeToZoom(1)).toBe(20);
    expect(rangeToZoom(1e12)).toBe(0);
  });
});

describe("formatTicker", () => {
  it("formats hemisphere, 4 decimals and a 3-digit heading", () => {
    expect(formatTicker(40.7484, -73.9857, 30)).toBe("40.7484° N · 73.9857° W · Heading 030°");
  });
  it("normalises negative and near-360 headings", () => {
    expect(formatTicker(0, 0, -30)).toContain("Heading 330°");
    expect(formatTicker(0, 0, 359.7)).toContain("Heading 000°");
  });
});

describe("interpolate / routePath", () => {
  const a = { lat: 0, lng: 0 }, b = { lat: 1, lng: 2 }, c = { lat: 2, lng: 2 };
  it("returns `steps` points ending exactly at b, excluding a", () => {
    const pts = interpolate(a, b, 4);
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual({ lat: 0.25, lng: 0.5 });
    expect(pts[3]).toEqual(b);
  });
  it("builds a whole route starting at the first stop", () => {
    const path = routePath([a, b, c], 2);
    expect(path).toHaveLength(5);
    expect(path[0]).toEqual(a);
    expect(path.at(-1)).toEqual(c);
  });
  it("handles no stops", () => {
    expect(routePath([], 5)).toEqual([]);
  });
});
