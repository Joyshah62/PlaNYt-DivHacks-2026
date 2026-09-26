import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "./profile";
import { decodePlan, encodePlan } from "./share";
import type { PlanRequest } from "./types";

const request: PlanRequest = {
  stops: [
    { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, visitMin: 150, attractionId: "met" },
    { key: "moma", name: "MoMA", lat: 40.7614, lon: -73.9776, visitMin: 90, attractionId: "moma" },
    { key: "place-joe-s-pizza", name: "Joe's Pizza — Carmine St", lat: 40.7305467, lon: -74.0020629, visitMin: 45, attractionId: null },
  ],
  date: "2026-09-26",
  startMin: 540,
  endMin: 1260,
  mode: "bike",
  crowd: "balanced",
  origin: { label: "Hôtel near Bryant Park", lat: 40.7536, lon: -73.9832 },
  returnToOrigin: true,
  profile: { pace: "relaxed", group: "seniors", walkMax: 10, interests: ["art", "views"] },
  meals: { lunch: true, dinner: false },
};

describe("share links", () => {
  it("round-trips a plan, including non-ASCII names", () => {
    const code = encodePlan(request);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = decodePlan(code)!;
    expect(back.stops.map((s) => [s.key, s.visitMin])).toEqual([["met", 150], ["moma", 90], ["place-joe-s-pizza", 45]]);
    expect(back.stops[2].name).toBe("Joe's Pizza — Carmine St");
    expect(back.origin?.label).toBe("Hôtel near Bryant Park");
    expect(back).toMatchObject({ date: "2026-09-26", startMin: 540, endMin: 1260, mode: "bike", crowd: "balanced", returnToOrigin: true });
    expect(back.profile).toEqual(request.profile);
    expect(back.meals).toEqual({ lunch: true, dinner: false });
  });

  it("keeps fixed start times on catalog and searched stops", () => {
    const stops = [
      { ...request.stops[0], fixedStartMin: 600 },
      { ...request.stops[2], fixedStartMin: 1200 },
    ];
    const back = decodePlan(encodePlan({ ...request, stops }))!;
    expect(back.stops.map((s) => s.fixedStartMin)).toEqual([600, 1200]);
  });

  it("keeps the meal a stop was picked for", () => {
    const stops = [
      { ...request.stops[2], mealFor: "lunch" as const },
      { ...request.stops[0], mealFor: "dinner" as const, fixedStartMin: 1140 },
      request.stops[1],
    ];
    const back = decodePlan(encodePlan({ ...request, stops }))!;
    expect(back.stops.map((s) => [s.key, s.mealFor ?? null, s.fixedStartMin])).toEqual([
      ["place-joe-s-pizza", "lunch", null],
      ["met", "dinner", 1140],
      ["moma", null, null],
    ]);
  });

  it("keeps a searched place's opening hours", () => {
    const hours = [null, [660, 1320], [660, 1320], [660, 1320], [660, 1320], [660, 1500], [600, 1500]] as NonNullable<PlanRequest["stops"][number]["hours"]>;
    const stops = [{ ...request.stops[2], hours }];
    expect(decodePlan(encodePlan({ ...request, stops }))!.stops[0].hours).toEqual(hours);
  });

  it("keeps a settled order", () => {
    expect(decodePlan(encodePlan({ ...request, keepOrder: true }))!.keepOrder).toBe(true);
    expect(decodePlan(encodePlan(request))!.keepOrder).toBeUndefined();
  });

  it("stays short for catalog stops", () => {
    const plain = { ...request, stops: request.stops.slice(0, 2), origin: null, profile: DEFAULT_PROFILE, meals: { lunch: false, dinner: false } };
    expect(encodePlan(plain).length).toBeLessThan(160);
  });

  it("rejects garbage", () => {
    expect(decodePlan("not-a-plan")).toBeNull();
    expect(decodePlan("")).toBeNull();
  });
});
