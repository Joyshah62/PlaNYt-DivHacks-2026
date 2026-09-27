import { describe, expect, it } from "vitest";
import { bikeCost, homeOptions, nightWaitMin, taxiCost, type ModeEstimates } from "./gettingHome";

const midtown = { lat: 40.754, lon: -73.984 };
const astoria = { lat: 40.775, lon: -73.912 };

describe("fares", () => {
  it("prices a non-member e-bike ride: $4.99 to unlock plus $0.41 a minute", () => {
    expect(bikeCost(20)).toBeCloseTo(4.99 + 20 * 0.41, 2);
  });

  it("prices a taxi from the meter, with the overnight and Manhattan surcharges", () => {
    const day = taxiCost({ miles: 3, from: astoria, to: astoria, atMin: 14 * 60 });
    expect(day).toBeCloseTo(3 + 3 * 3.5 + 0.5 + 1, 1);
    const night = taxiCost({ miles: 3, from: midtown, to: astoria, atMin: 22 * 60 });
    expect(night).toBeCloseTo(3 + 3 * 3.5 + 0.5 + 1 + 1 + 2.5 + 0.75, 1);
  });
});

describe("Manhattan surcharges", () => {
  it("apply in Midtown but not in Queens", () => {
    const base = 3 + 1 * 3.5 + 0.5 + 1;
    expect(taxiCost({ miles: 1, from: astoria, to: astoria, atMin: 12 * 60 })).toBeCloseTo(base, 2);
    expect(taxiCost({ miles: 1, from: midtown, to: midtown, atMin: 12 * 60 })).toBeCloseTo(base + 2.5 + 0.75, 2);
    expect(taxiCost({ miles: 1, from: { lat: 40.812, lon: -73.947 }, to: { lat: 40.812, lon: -73.947 }, atMin: 12 * 60 })).toBeCloseTo(base, 2);
  });
});

describe("nightWaitMin", () => {
  it("adds waiting for trains late at night", () => {
    expect(nightWaitMin(21 * 60)).toBe(0);
    expect(nightWaitMin(23 * 60 + 30)).toBeGreaterThan(0);
    expect(nightWaitMin(25 * 60)).toBeGreaterThan(nightWaitMin(23 * 60 + 30));
  });
});

describe("homeOptions", () => {
  const est: ModeEstimates = { subway: 34, bike: 30, taxi: 22, walk: 110, miles: 5 };

  it("lists every way home with time and rough cost, and highlights the best", () => {
    const o = homeOptions(est, { from: midtown, to: astoria, atMin: 19 * 60 });
    expect(o.options.map((x) => x.mode)).toEqual(["subway", "bike", "taxi", "walk"]);
    expect(o.options.find((x) => x.mode === "subway")).toMatchObject({ minutes: 34, cost: 3 });
    expect(o.best).toBe("subway");
    expect(o.warning).toBeNull();
  });

  it("warns when a long subway ride runs into late-night service", () => {
    const o = homeOptions(est, { from: midtown, to: astoria, atMin: 23 * 60 + 45 });
    expect(o.options.find((x) => x.mode === "subway")!.minutes).toBeGreaterThan(34);
    expect(o.warning).toMatch(/leave by|trains/i);
  });

  it("recommends walking when home is close", () => {
    const o = homeOptions({ subway: 14, bike: 8, taxi: 7, walk: 12, miles: 0.6 }, { from: midtown, to: midtown, atMin: 18 * 60 });
    expect(o.best).toBe("walk");
  });

  it("drops the subway when there's no sensible train", () => {
    const o = homeOptions({ subway: null, bike: 30, taxi: 22, walk: 110, miles: 5 }, { from: midtown, to: astoria, atMin: 18 * 60 });
    expect(o.options.map((x) => x.mode)).toEqual(["bike", "taxi", "walk"]);
  });
});
