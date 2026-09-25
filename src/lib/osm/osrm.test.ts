import { describe, expect, it } from "vitest";
import { parseTable, toMinutes } from "./osrm";
import { applyRoutedWalks, buildCommuteReport, placesToRoute } from "./report";
import { CENTER, place } from "./__fixtures__";

describe("parseTable", () => {
  it("takes each destination's fastest origin candidate", () => {
    const legs = parseTable(
      {
        code: "Ok",
        durations: [
          [681, 711],
          [70, 625],
        ],
        distances: [
          [851, 889],
          [88, 781],
        ],
      },
      2,
    );
    expect(legs).toEqual([
      { duration: 70, distance: 88 },
      { duration: 625, distance: 781 },
    ]);
  });

  it("keeps unreachable destinations as null", () => {
    expect(parseTable({ code: "Ok", durations: [[null, 60]], distances: [[null, 80]] }, 2)).toEqual([
      { duration: null, distance: null },
      { duration: 60, distance: 80 },
    ]);
  });

  it("rejects errors and mismatched shapes", () => {
    expect(parseTable({ code: "InvalidQuery" }, 1)).toBeNull();
    expect(parseTable({ code: "Ok", durations: [[1, 2, 3]] }, 2)).toBeNull();
  });

  it("rounds to at least a minute", () => {
    expect(toMinutes(10)).toBe(1);
    expect(toMinutes(150)).toBe(3);
    expect(toMinutes(null)).toBeNull();
  });
});

describe("routed walks", () => {
  const places = [
    place({ id: "g1", category: "groceries", walkMin: 3, estimated: true }),
    place({ id: "g2", category: "groceries", walkMin: 4, estimated: true }),
    place({ id: "g3", category: "groceries", walkMin: 5, estimated: true }),
    place({ id: "g4", category: "groceries", walkMin: 6, estimated: true }),
  ];

  it("routes only the nearest three per category", () => {
    expect(placesToRoute(places).map((p) => p.id)).toEqual(["g1", "g2", "g3"]);
  });

  it("replaces estimates with routed times and leaves the rest estimated", () => {
    const routed = placesToRoute(places);
    const out = applyRoutedWalks(places, routed, [
      { duration: 420, distance: 500 },
      { duration: null, distance: null },
      { duration: 240, distance: 300 },
    ]);
    expect(out.map((p) => [p.id, p.walkMin, p.estimated])).toEqual([
      ["g1", 7, false],
      ["g2", 4, true],
      ["g3", 4, false],
      ["g4", 6, true],
    ]);
  });

  it("leaves everything estimated when routing failed", () => {
    expect(applyRoutedWalks(places, placesToRoute(places), null)).toEqual(places);
  });
});

describe("buildCommuteReport", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");
  const near = { id: "near", label: "Near", kind: "work" as const, lat: CENTER.lat + 0.01, lon: CENTER.lon };
  const far = { id: "far", label: "Times Square", kind: "preset" as const, lat: 40.758, lon: -73.9855 };

  it("uses routed legs and converts meters to miles", () => {
    const report = buildCommuteReport({
      center: CENTER,
      targets: [near, far],
      unresolved: [],
      walk: [{ duration: 900, distance: 1200 }, { duration: null, distance: null }],
      drive: [{ duration: 300, distance: 1609.344 }, { duration: 1680, distance: 18350 }],
      now,
    });
    expect(report.routingStatus.ok).toBe(true);
    expect(report.rows[0]).toMatchObject({ walkMin: 15, driveMin: 5, driveMiles: 1, estimated: false });
    expect(report.rows[1]).toMatchObject({ walkMin: null, driveMin: 28, driveMiles: 11.4 });
  });

  it("falls back to estimates, but never estimates an unwalkable walk", () => {
    const report = buildCommuteReport({ center: CENTER, targets: [near, far], unresolved: ["Nowhere"], walk: null, drive: null, now });
    expect(report.routingStatus.ok).toBe(false);
    expect(report.rows[0].estimated).toBe(true);
    expect(report.rows[0].walkMin).toBeGreaterThan(0);
    expect(report.rows[1].walkMin).toBeNull();
    expect(report.rows[1].driveMin).toBeGreaterThan(0);
    expect(report.unresolved).toEqual(["Nowhere"]);
  });
});
