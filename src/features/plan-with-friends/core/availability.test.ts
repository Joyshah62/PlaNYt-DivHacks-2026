import { describe, expect, it } from "vitest";
import { applyWindow, missingFor, sharedWindow } from "./availability";

const h = (n: number) => n * 60;

describe("sharedWindow", () => {
  it("is the overlap when everyone's free at once", () => {
    expect(sharedWindow({ a: { from: h(10), to: h(22) }, b: { from: h(15), to: h(23) } })).toEqual({ from: h(15), to: h(22), everyone: true, missing: [] });
  });

  it("falls back to the time most people share, and says who misses it", () => {
    const w = sharedWindow({ a: { from: h(10), to: h(14) }, b: { from: h(15), to: h(22) }, c: { from: h(16), to: h(23) } });
    expect(w).toEqual({ from: h(16), to: h(22), everyone: false, missing: ["a"] });
  });

  it("ignores overlaps shorter than an hour", () => {
    const w = sharedWindow({ a: { from: h(10), to: h(15) + 30 }, b: { from: h(15), to: h(20) } });
    expect(w?.everyone).toBe(false);
    expect(w!.to - w!.from).toBeGreaterThanOrEqual(60);
  });

  it("is null when nobody said", () => {
    expect(sharedWindow({})).toBeNull();
  });
});

describe("applyWindow", () => {
  it("sets the day's start and end", () => {
    expect(applyWindow({ startMin: h(10), endMin: h(21) }, { from: h(15), to: h(23), everyone: true, missing: [] })).toEqual({ startMin: h(15), endMin: h(23) });
    expect(applyWindow({ startMin: h(10), endMin: h(21) }, null)).toEqual({ startMin: h(10), endMin: h(21) });
  });
});

describe("missingFor", () => {
  it("lists who isn't free for a stop's time", () => {
    const free = { a: { from: h(10), to: h(14) }, b: { from: h(15), to: h(22) } };
    expect(missingFor(free, h(16), h(17))).toEqual(["a"]);
    expect(missingFor(free, h(12), h(13))).toEqual(["b"]);
  });
});
