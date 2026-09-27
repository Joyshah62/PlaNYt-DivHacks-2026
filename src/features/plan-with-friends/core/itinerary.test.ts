import { describe, expect, it } from "vitest";
import { autoPick, basisOf, resolveItinerary } from "./itinerary";

const place = (key: string, votes: number, visitMin: number, lat = 40.75) => ({ stop: { key, name: key, lat, lon: -73.98, visitMin, attractionId: null }, votes: Array.from({ length: votes }, (_, i) => `m${i}`) });
const travel = () => 15;

describe("autoPick", () => {
  it("takes places in vote order while they fit the window", () => {
    const keys = autoPick([place("a", 3, 120), place("b", 2, 120), place("c", 1, 60)], 300, travel, null);
    expect(keys).toEqual(["a", "b"]);
  });

  it("skips one that doesn't fit and tries the next", () => {
    expect(autoPick([place("a", 3, 120), place("big", 2, 400), place("c", 1, 60)], 300, travel, null)).toEqual(["a", "c"]);
  });

  it("still plans the top place when nothing fits, and nothing when nobody voted", () => {
    expect(autoPick([place("huge", 1, 900)], 120, travel, null)).toEqual(["huge"]);
    expect(autoPick([], 600, travel, null)).toEqual([]);
  });

  it("stops at 10 places", () => {
    const many = Array.from({ length: 14 }, (_, i) => place(`p${i}`, 1, 10));
    expect(autoPick(many, 2000, () => 1, null)).toHaveLength(10);
  });
});

describe("basisOf", () => {
  it("changes with votes, the window or the meeting spot, and not otherwise", () => {
    const base = { ranking: [["a", 2] as [string, number]], window: { from: 600, to: 900 }, origin: { lat: 1, lon: 2 } };
    expect(basisOf(base)).toBe(basisOf(structuredClone(base)));
    expect(basisOf({ ...base, ranking: [["a", 3]] })).not.toBe(basisOf(base));
    expect(basisOf({ ...base, window: { from: 660, to: 900 } })).not.toBe(basisOf(base));
    expect(basisOf({ ...base, origin: { lat: 1.1, lon: 2 } })).not.toBe(basisOf(base));
  });
});

describe("resolveItinerary", () => {
  const places = [place("a", 3, 60), place("b", 2, 60), place("c", 1, 60)];
  it("uses the automatic pick until someone edits", () => {
    const r = resolveItinerary({ places, stored: null, basis: "x", budget: 600, travel, origin: null });
    expect(r).toMatchObject({ keys: ["a", "b", "c"], manual: false, stale: false, tray: [] });
  });

  it("keeps a manual order, drops removed places, and flags it stale when the basis moves", () => {
    const stored = { order: ["c", "gone", "a"], editedBy: "m1", editedAt: 5, basis: "old" };
    const r = resolveItinerary({ places, stored, basis: "new", budget: 600, travel, origin: null });
    expect(r).toMatchObject({ keys: ["c", "a"], manual: true, stale: true, tray: ["b"], editedBy: "m1", editedAt: 5 });
    expect(resolveItinerary({ places, stored: { ...stored, basis: "new" }, basis: "new", budget: 600, travel, origin: null }).stale).toBe(false);
  });
});
