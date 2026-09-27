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
