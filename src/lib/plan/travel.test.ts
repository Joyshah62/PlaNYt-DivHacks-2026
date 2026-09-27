import { describe, expect, it, vi } from "vitest";
import { osrmMatrix } from "@/lib/osm/osrm";
import { legMatrix, subwayLeg } from "./travel";

vi.mock("@/lib/osm/osrm", () => ({ osrmMatrix: vi.fn() }));
/** OSRM walking every pair in `minutes`. */
const walking = (minutes: number) => vi.mocked(osrmMatrix).mockImplementationOnce(async (_p, points) => points.map((_, i) => points.map((__, j) => ({ duration: i === j ? 0 : minutes * 60, distance: i === j ? 0 : minutes * 80 }))));

const prospectPark = { lat: 40.674, lon: -73.97 };
const peterLuger = { lat: 40.7098661, lon: -73.9625564 };
const williamsburg = { lat: 40.7171, lon: -73.957 };

describe("getting around by transit", () => {
  it("crosses Brooklyn by subway, via Manhattan if that's the way, rather than an hour's walk", async () => {
    const leg = subwayLeg(prospectPark, peterLuger);
    expect(leg?.rides?.map((r) => r.to.label)).toEqual(["Fulton St", "Marcy Av"]);
    walking(64);
    const { legs } = await legMatrix("transit", [prospectPark, peterLuger], 15);
    expect(legs[0][1]).toMatchObject({ mode: "subway", minutes: leg!.minutes });
  });

  it("walks a little past the limit rather than ride twice as long", async () => {
    walking(13);
    const { legs } = await legMatrix("transit", [peterLuger, williamsburg], 10);
    expect(legs[0][1]).toMatchObject({ mode: "walk", minutes: 13 });
  });

  it("rides past the limit when the train is only somewhat slower", async () => {
    const train = subwayLeg(peterLuger, williamsburg)!;
    walking(Math.ceil(train.minutes / 1.5));
    const { legs } = await legMatrix("transit", [williamsburg, peterLuger].reverse(), 5);
    expect(legs[0][1].mode).toBe("subway");
  });
});

describe("too far to walk, no subway", () => {
  const jfk = { lat: 40.6413, lon: -73.7781 };
  const upperWestSide = { lat: 40.7813, lon: -73.974 };

  it("takes a cab from the airport rather than a six-hour walk", async () => {
    expect(subwayLeg(jfk, upperWestSide)).toBeNull();
    walking(369);
    // The road times: 35 minutes free-flow, before traffic.
    vi.mocked(osrmMatrix).mockImplementationOnce(async (_p, points) => points.map((_, i) => points.map((__, j) => ({ duration: i === j ? 0 : 35 * 60, distance: i === j ? 0 : 27_000 }))));
    const { legs } = await legMatrix("transit", [jfk, upperWestSide], null);
    expect(legs[0][1]).toMatchObject({ mode: "taxi", estimated: true });
    expect(legs[0][1].minutes).toBeLessThan(70);
  });

  it("keeps a short walk a walk, without asking for road times", async () => {
    const calls = vi.mocked(osrmMatrix).mock.calls.length;
    walking(12);
    const { legs } = await legMatrix("transit", [{ lat: 40.7794, lon: -73.9632 }, { lat: 40.7812, lon: -73.9665 }], null);
    expect(legs[0][1].mode).toBe("walk");
    expect(vi.mocked(osrmMatrix).mock.calls.length).toBe(calls + 1);
  });
});
