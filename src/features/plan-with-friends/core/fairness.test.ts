import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, type PlanRequest } from "../bridge/index";
import { fairestPoint, MEETUP_PREFIX, roundPoint, walkMinutes, withGroupStart } from "./fairness";

// A toy city on a line: travel time is just the distance in "minutes".
const travel = (a: { lat: number }, b: { lat: number }) => Math.abs(a.lat - b.lat);
const starts = { ana: { lat: 0, lon: 0 }, ben: { lat: 10, lon: 0 }, cy: { lat: 30, lon: 0 } };
const p = (key: string, lat: number) => ({ key, name: key.toUpperCase(), lat, lon: 0 });

describe("fairestPoint", () => {
  it("picks the place with the shortest worst-case trip", () => {
    const best = fairestPoint(starts, [p("a", 0), p("b", 14), p("c", 30)], travel);
    expect(best).toMatchObject({ key: "b", worst: 16, perMember: { ana: 14, ben: 4, cy: 16 } });
  });

  it("breaks ties on total travel", () => {
    const best = fairestPoint({ ana: { lat: 0, lon: 0 }, ben: { lat: 20, lon: 0 } }, [p("x", 0), p("y", 10), p("z", 20)], travel);
    expect(best?.key).toBe("y");
  });

  it("returns null with no starting points or no places", () => {
    expect(fairestPoint({}, [p("a", 1)], travel)).toBeNull();
    expect(fairestPoint(starts, [], travel)).toBeNull();
  });
});

describe("walkMinutes", () => {
  it("is about 12-13 minutes for a kilometre", () => {
    expect(walkMinutes({ lat: 40.75, lon: -73.99 }, { lat: 40.759, lon: -73.99 })).toBeGreaterThan(11);
    expect(walkMinutes({ lat: 40.75, lon: -73.99 }, { lat: 40.759, lon: -73.99 })).toBeLessThan(16);
  });
});

describe("roundPoint", () => {
  it("snaps to a ~200 m grid so exact homes aren't stored", () => {
    expect(roundPoint({ lat: 40.72365, lon: -73.98795 })).toEqual({ lat: 40.724, lon: -73.988 });
  });
});

describe("withGroupStart", () => {
  const request: PlanRequest = {
    stops: [
      { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, visitMin: 150, attractionId: "met" },
      { key: `${MEETUP_PREFIX}610`, name: "Meet at Union Sq", lat: 40.7359, lon: -73.9906, visitMin: 10, attractionId: null },
    ],
    date: "2026-10-03",
    startMin: 600,
    endMin: 1260,
    mode: "transit",
    crowd: "avoid",
    origin: null,
    returnToOrigin: false,
    profile: DEFAULT_PROFILE,
    meals: { lunch: false, dinner: false },
  };

  it("starts the day at a voted-in meetup spot and takes it out of the stops", () => {
    const r = withGroupStart(request, null);
    expect(r.origin).toEqual({ label: "Meet at Union Sq", lat: 40.7359, lon: -73.9906 });
    expect(r.stops.map((s) => s.key)).toEqual(["met"]);
  });

  it("otherwise starts at the fairest stop", () => {
    const plain = { ...request, stops: [request.stops[0]] };
    const r = withGroupStart(plain, { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, worst: 20, total: 30, perMember: {} });
    expect(r.origin).toEqual({ label: "Start at The Met", lat: 40.7794, lon: -73.9632 });
    expect(r.returnToOrigin).toBe(false);
  });

  it("leaves the request alone when nobody shared a start", () => {
    const plain = { ...request, stops: [request.stops[0]] };
    expect(withGroupStart(plain, null)).toEqual(plain);
  });
});
