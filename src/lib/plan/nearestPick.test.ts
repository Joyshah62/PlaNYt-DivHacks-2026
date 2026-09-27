import { describe, expect, it } from "vitest";
import { nearestPicks } from "./nearestPick";

const DUMBO = { lat: 40.7033, lon: -73.9894 };
const BRIDGE = { lat: 40.7061, lon: -73.9969 };
const JOES_VILLAGE = { key: "joes", lat: 40.7306, lon: -74.0027 };
const JULIANAS = { key: "julianas", lat: 40.7026, lon: -73.9934 };
const LUCALI = { key: "lucali", lat: 40.6818, lon: -74.0007 };

describe("nearestPicks", () => {
  it("swaps a famous pick across the river for a good one by the rest of the day", () => {
    expect(nearestPicks([DUMBO, BRIDGE], [{ current: "joes", options: [JOES_VILLAGE, JULIANAS, LUCALI] }])).toEqual(["julianas"]);
  });
  it("keeps the assistant's pick when it's about as close", () => {
    const nearby = { key: "near", lat: 40.7045, lon: -73.9905 };
    expect(nearestPicks([DUMBO], [{ current: "julianas", options: [JULIANAS, nearby] }])).toEqual(["julianas"]);
  });
  it("keeps the pick when there's nothing else in the day to be near", () => {
    expect(nearestPicks([], [{ current: "joes", options: [JOES_VILLAGE, JULIANAS] }])).toEqual(["joes"]);
  });
  it("pulls two wishes toward each other when nothing else anchors the day", () => {
    const view = { current: "bridge", options: [{ key: "bridge", ...BRIDGE }] };
    expect(nearestPicks([], [view, { current: "joes", options: [JOES_VILLAGE, JULIANAS] }])).toEqual(["bridge", "julianas"]);
  });
});
