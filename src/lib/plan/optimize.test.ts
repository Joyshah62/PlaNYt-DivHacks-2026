import { describe, expect, it } from "vitest";
import { crowdBand, crowdProfile, levelDuring } from "./crowd";
import { optimize, simulate, type OptimizeInput } from "./optimize";
import { stationLines, subwayLeg } from "./travel";
import { clock, duration, weekdayOf } from "./time";

const flat = (v: number) => Array(24).fill(v);

function input(overrides: Partial<OptimizeInput> & Pick<OptimizeInput, "travel">): OptimizeInput {
  const n = overrides.travel.length;
  return {
    visitMin: Array(n).fill(60),
    windows: Array(n).fill("always"),
    levels: Array(n).fill(null),
    fromOrigin: null,
    toOrigin: null,
    startMin: 9 * 60,
    endMin: 21 * 60,
    crowdWeight: 0,
    ...overrides,
  };
}

describe("optimize", () => {
  it("won't zig-zag across town to dodge a crowd", () => {
    // Stops on a line at 0, 10 and 40 minutes from the start; the far one is quiet only early.
    // Dodging its afternoon crowd means going out to it first and coming all the way back.
    const pos = [0, 10, 40];
    const travel = pos.map((a) => pos.map((b) => Math.abs(a - b)));
    const busyLater = Array.from({ length: 24 }, (_, h) => (h < 12 ? 0 : 1));
    const day = input({ travel, fromOrigin: pos, visitMin: [120, 120, 120], levels: [null, null, busyLater], crowdWeight: 1.2 });
    const { best } = optimize(day);
    expect(best.order).toEqual([0, 1, 2]);
    expect(best.travelMin).toBe(40);
  });

  it("finds the shortest path through points on a line", () => {
    // Stops at positions 0, 30, 10, 20 on a line; the best tour visits them in position order.
    const pos = [0, 30, 10, 20];
    const travel = pos.map((a) => pos.map((b) => Math.abs(a - b)));
    const { best, exhaustive } = optimize(input({ travel }));
    expect(exhaustive).toBe(true);
    expect(best.travelMin).toBe(30);
    expect([best.order, [...best.order].reverse()]).toContainEqual([0, 2, 3, 1]);
  });

  it("starts from the origin when there is one", () => {
    const pos = [0, 30, 10, 20];
    const travel = pos.map((a) => pos.map((b) => Math.abs(a - b)));
    const { best } = optimize(input({ travel, fromOrigin: pos.map((p) => Math.abs(p - 35)) }));
    expect(best.order).toEqual([1, 3, 2, 0]);
  });

  it("puts a museum that closes early first", () => {
    const travel = [
      [0, 10],
      [10, 0],
    ];
    const { best } = optimize(
      input({ travel, visitMin: [120, 120], windows: ["always", [10 * 60, 12 * 60]], startMin: 10 * 60 }),
    );
    expect(best.order).toEqual([1, 0]);
    expect(best.issues).toBe(0);
  });

  it("flags a stop that is closed all day, whatever the order", () => {
    const { best } = optimize(input({ travel: [[0, 5], [5, 0]], windows: ["always", null] }));
    expect(best.issues).toBe(1);
    expect(best.visits.find((v) => v.index === 1)?.issue).toBe("closed");
  });

  it("waits for opening time rather than calling it a conflict", () => {
    const sim = simulate(input({ travel: [[0]], windows: [[10 * 60, 17 * 60]], startMin: 9 * 60 }), [0]);
    expect(sim.visits[0]).toMatchObject({ arriveMin: 540, startMin: 600, waitMin: 60, issue: null });
  });

  it("visits the crowded place at its quiet hour when crowds matter", () => {
    // Stop 0 is packed from noon; stop 1 is always moderate. Equal travel either way.
    const busyAfternoon = flat(0.2).map((v, h) => (h >= 12 ? 1 : v));
    const travel = [
      [0, 10],
      [10, 0],
    ];
    const base = { travel, visitMin: [120, 120], levels: [busyAfternoon, flat(0.5)], startMin: 10 * 60 };
    expect(optimize(input({ ...base, crowdWeight: 1 })).best.order).toEqual([0, 1]);
    // Starting with the calm one is equally good when crowds don't count.
    const ignoring = optimize(input({ ...base, crowdWeight: 0 })).best;
    expect(ignoring.cost).toBe(10);
  });

  it("counts time past the end of the day", () => {
    const sim = simulate(input({ travel: [[0]], visitMin: [120], startMin: 20 * 60, endMin: 21 * 60 }), [0]);
    expect(sim.overMin).toBe(60);
  });

  it("stays fast and exact for a full day of ten stops", () => {
    const pts = Array.from({ length: 10 }, (_, i) => [Math.cos(i * 2.3) * 40, Math.sin(i * 1.7) * 40]);
    const travel = pts.map((a) => pts.map((b) => Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]))));
    const t0 = performance.now();
    const { best } = optimize(input({ travel, visitMin: Array(10).fill(30) }));
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(best.order).toHaveLength(10);
    expect(new Set(best.order).size).toBe(10);
  });
});

describe("fixed times, meals and breathers", () => {
  // Three places in a row, 20 minutes apart.
  const line = [
    [0, 20, 40],
    [20, 0, 20],
    [40, 20, 0],
  ];

  it("works the day around a booked time", () => {
    // Stop 2 is booked for 1pm; the other two fit before it.
    const { best } = optimize(input({ travel: line, fixedStart: [null, null, 13 * 60] }));
    expect(best.order[2]).toBe(2);
    const booked = best.visits.find((v) => v.index === 2)!;
    expect(booked.startMin).toBe(13 * 60);
    expect(booked.issue).toBeNull();
  });

  it("flags a booking the day can't reach in time", () => {
    const sim = simulate(input({ travel: [[0]], visitMin: [60], fixedStart: [8 * 60], startMin: 9 * 60 }), [0]);
    expect(sim.visits[0].issue).toBe("late");
  });

  it("floats a meal: no travel to it, and the next leg starts from the last real place", () => {
    const travel = [
      [0, 99, 20],
      [99, 0, 99],
      [20, 99, 0],
    ];
    const lunch = [11 * 60 + 30, 14 * 60] as [number, number];
    const base = input({
      travel,
      visitMin: [120, 60, 60],
      floating: [false, true, false],
      softWindow: [null, lunch, null],
      startMin: 9 * 60 + 30,
    });
    const { best } = optimize(base);
    expect(best.order).toEqual([0, 1, 2]);
    expect(best.travelMin).toBe(20);
    const meal = best.visits.find((v) => v.index === 1)!;
    expect(meal.startMin).toBe(11 * 60 + 30);
  });

  it("never serves a meal before its window", () => {
    const sim = simulate(
      input({ travel: [[0]], visitMin: [60], floating: [true], softWindow: [[11 * 60 + 30, 14 * 60]], startMin: 9 * 60 }),
      [0],
    );
    expect(sim.visits[0].startMin).toBe(11 * 60 + 30);
  });

  it("adds a breather between places, not around meals", () => {
    const sim = simulate(input({ travel: line, visitMin: [30, 30, 30], floating: [false, true, false], bufferMin: 15 }), [0, 1, 2]);
    // 0 -> meal: no travel, no breather; meal -> 2: travel from 0 (40), no breather after a meal.
    expect(sim.travelMin).toBe(40);
  });
});

describe("crowd", () => {
  it("weights a visit's crowd by the minutes spent in each hour", () => {
    const levels = flat(0);
    levels[10] = 1;
    expect(levelDuring(levels, 600, 660)).toBe(1);
    expect(levelDuring(levels, 630, 690)).toBe(0.5);
  });

  it("reads Times Square as busier on a Saturday evening than a Saturday morning", () => {
    const p = crowdProfile({ lat: 40.758, lon: -73.9855 }, 6)!;
    expect(p.station).toMatch(/Times Sq/);
    expect(p.levels[17]).toBeGreaterThan(p.levels[8]);
  });

  it("has no profile far from any station", () => {
    expect(crowdProfile({ lat: 40.6, lon: -74.2 }, 1)).toBeNull();
  });

  it("bands levels", () => {
    expect([0.1, 0.5, 0.7, 0.95].map(crowdBand)).toEqual(["quiet", "moderate", "busy", "peak"]);
  });
});

describe("subway directions", () => {
  it("reads the lines out of a station complex name", () => {
    expect(stationLines("Times Sq-42 St/Port Authority Bus Terminal (1,2,3,7,A,C,E,N,Q,R,W,S)")).toEqual({
      name: "Times Sq-42 St/Port Authority Bus Terminal",
      lines: ["1", "2", "3", "7", "A", "C", "E", "N", "Q", "R", "W", "S"],
    });
  });

  it("sends the Met to the 9/11 Memorial on the Lexington express, downtown", () => {
    const leg = subwayLeg({ lat: 40.7794, lon: -73.9632 }, { lat: 40.7115, lon: -74.0134 })!;
    expect(leg.rides).toHaveLength(1);
    expect(leg.rides![0].lines).toEqual(expect.arrayContaining(["4", "5"]));
    expect(leg.rides![0].direction).toBe("downtown");
  });

  it("changes trains when no line serves both ends", () => {
    const leg = subwayLeg({ lat: 40.7614, lon: -73.9776 }, { lat: 40.759, lon: -73.83 })!;
    expect(leg.rides).toHaveLength(2);
    expect(leg.rides![1].lines).toContain("7");
  });
});

describe("subway estimate", () => {
  it("boards near the start and gets off near the end", () => {
    const leg = subwayLeg({ lat: 40.7794, lon: -73.9632 }, { lat: 40.7115, lon: -74.0134 })!;
    expect(leg.mode).toBe("subway");
    expect(leg.estimated).toBe(true);
    expect(leg.minutes).toBeGreaterThan(20);
    expect(leg.minutes).toBeLessThan(60);
  });
});

describe("time", () => {
  it("formats clock times and durations", () => {
    expect([clock(0), clock(615), clock(720), clock(1500)]).toEqual(["12am", "10:15am", "12pm", "1am"]);
    expect([duration(40), duration(95), duration(120)]).toEqual(["40 min", "1h 35m", "2h"]);
  });

  it("finds the weekday of a date string regardless of time zone", () => {
    expect(weekdayOf("2026-09-26")).toBe(6);
  });
});
