import { describe, expect, it } from "vitest";
import { parseTable, toMinutes } from "./osrm";

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
