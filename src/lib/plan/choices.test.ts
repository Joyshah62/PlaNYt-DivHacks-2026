import { describe, expect, it } from "vitest";
import { bestOutcome, fillSlot } from "./choices";
import type { ChoiceOutcome, StopInput } from "./types";

const stop = (key: string, extra: Partial<StopInput> = {}): StopInput => ({ key, name: key, lat: 40.75, lon: -73.98, visitMin: 60, attractionId: null, ...extra });
const outcome = (key: string | null, travelMin: number, extra: Partial<ChoiceOutcome> = {}): ChoiceOutcome => ({
  key,
  startMin: 600,
  travelMin,
  finishMin: 1000,
  overMin: 0,
  crowdBand: null,
  issue: null,
  closed: false,
  ...extra,
});

describe("fillSlot", () => {
  const day = [stop("met"), stop("view", { fixedStartMin: 1080 }), stop("pizza")];

  it("puts the option where the slot was and keeps its set time", () => {
    const next = fillSlot(day, "view", { ...stop("summit"), why: "Sunset" });
    expect(next.map((s) => s.key)).toEqual(["met", "summit", "pizza"]);
    expect(next[1].fixedStartMin).toBe(1080);
    expect(next[1]).not.toHaveProperty("why");
  });

  it("keeps the meal the slot was for", () => {
    const withLunch = [stop("met"), stop("pizza", { mealFor: "lunch" })];
    expect(fillSlot(withLunch, "pizza", stop("other-pizza"))[1].mealFor).toBe("lunch");
  });

  it("adds to the end when there is no slot, and empties the slot for a null option", () => {
    expect(fillSlot(day, null, stop("lunch-spot", { mealFor: "lunch" })).map((s) => s.key)).toEqual(["met", "view", "pizza", "lunch-spot"]);
    expect(fillSlot(day, "pizza", null).map((s) => s.key)).toEqual(["met", "view"]);
  });

  it("never duplicates a place already in the day", () => {
    expect(fillSlot(day, "view", stop("met")).map((s) => s.key)).toEqual(["pizza", "met"]);
  });
});

describe("bestOutcome", () => {
  it("names a clear winner and nothing when it's close", () => {
    expect(bestOutcome([outcome("a", 40), outcome("b", 25)])?.key).toBe("b");
    expect(bestOutcome([outcome("a", 40), outcome("b", 39)])).toBeNull();
  });

  it("never picks a place that is closed that day", () => {
    expect(bestOutcome([outcome("a", 40), outcome("b", 5, { closed: true })])?.key).toBe("a");
  });
});
