import { describe, expect, it, vi } from "vitest";
import type { LatLon } from "@/lib/osm/types";
import type { PlanRequest } from "@/lib/plan/types";
import { DEFAULT_PROFILE } from "@/lib/plan/profile";
import { buildPlan } from "@/lib/plan/build";
import { evaluate } from "./evaluate";
import { fallbackIntent } from "./intent";
import type { Candidate } from "./types";

// Deterministic travel; exercise the real insertion and scheduling code offline.
vi.mock("@/lib/plan/travel", () => ({
  legMatrix: async (_mode: string, points: LatLon[]) => ({
    routed: true,
    legs: points.map((_, i) => points.map((__, j) => ({ mode: "walk", minutes: i === j ? 0 : 10, meters: 500, estimated: false }))),
  }),
}));
const request: PlanRequest = {
  stops: [
    { key: "a", name: "First stop", lat: 40.75, lon: -73.99, visitMin: 60, attractionId: null },
    { key: "b", name: "Second stop", lat: 40.76, lon: -73.98, visitMin: 60, attractionId: null },
  ],
  date: "2026-09-26", startMin: 540, endMin: 1080, mode: "walk", crowd: "ignore",
  origin: null, returnToOrigin: false, profile: { ...DEFAULT_PROFILE, pace: "packed" },
  meals: { lunch: false, dinner: false }, keepOrder: true,
};
const candidate: Candidate = {
  id: "cafe", name: "Test Café", lat: 40.755, lon: -73.985, category: "cafe", kind: "Café",
  cuisine: null, rating: null, reviews: null, price: null, hours: null, address: null,
  website: null, source: "openstreetmap", meters: 100,
};
const intent = { ...fallbackIntent("coffee", null), after: "a", visitMin: 30 };

describe("discovery placement", () => {
  it("places the candidate after the chosen stop, at the preferred time, and reproduces the preview when added", async () => {
    const [result] = await evaluate(request, [candidate], intent, 720);
    expect(result.nextStops.map((s) => s.key)).toEqual(["a", "find-cafe", "b"]);
    expect(result.startMin).toBe(720);
    expect(result.after).toBe("First stop");
    const added = await buildPlan({ ...request, stops: result.nextStops, keepOrder: true });
    expect(added.stops.find((s) => s.key === result.stop.key)?.startMin).toBe(result.startMin);
  });

  it("reports a preferred time that cannot be reached after the selected stop", async () => {
    const [result] = await evaluate(request, [candidate], { ...intent, after: "b" }, 570);
    expect(result.startMin).toBeGreaterThan(570);
    expect(result.conflicts.some((c) => c.includes("preferred"))).toBe(true);
  });

  it("reports a candidate's own closing-time conflict", async () => {
    const hours: Candidate["hours"] = Array.from({ length: 7 }, () => [540, 620]);
    const [result] = await evaluate(request, [{ ...candidate, hours }], intent);
    expect(result.conflicts).toContain("Test Café closes before this visit would finish");
  });

  it("preserves the replaced stop's slot and booked time", async () => {
    const booked = { ...request, stops: request.stops.map((s) => s.key === "b" ? { ...s, fixedStartMin: 720 } : s) };
    const [result] = await evaluate(booked, [candidate], { ...intent, after: null, replace: "b" });
    expect(result.nextStops.map((s) => s.key)).toEqual(["a", "find-cafe"]);
    expect(result.stop.fixedStartMin).toBe(720);
    expect(result.startMin).toBe(720);
  });
});
