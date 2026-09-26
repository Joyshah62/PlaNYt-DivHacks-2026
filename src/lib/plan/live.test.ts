import { describe, expect, it } from "vitest";
import { nextStep } from "./live";
import type { DayPlan, PlannedStop } from "./types";

const stop = (key: string, arriveMin: number, endMin: number, legMin: number | null): PlannedStop =>
  ({ key, name: key, arriveMin, startMin: arriveMin, endMin, leg: legMin === null ? null : { mode: "walk", minutes: legMin } }) as unknown as PlannedStop;

const plan = { stops: [stop("met", 600, 750, 20), stop("moma", 780, 900, 30)] } as unknown as DayPlan;

describe("what's next", () => {
  it("says when to leave before the day starts", () => {
    expect(nextStep(plan, 540)).toMatchObject({ kind: "before", leaveBy: 580 });
  });
  it("knows the traveler is on the way, at a stop, or finished", () => {
    expect(nextStep(plan, 590)).toMatchObject({ kind: "moving", arriveBy: 600 });
    expect(nextStep(plan, 700)).toMatchObject({ kind: "at", until: 750, next: { key: "moma" } });
    expect(nextStep(plan, 760)).toMatchObject({ kind: "moving", to: { key: "moma" }, from: { key: "met" } });
    expect(nextStep(plan, 950)).toEqual({ kind: "done" });
  });
});
