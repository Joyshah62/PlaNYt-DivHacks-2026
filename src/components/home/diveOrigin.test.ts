import { describe, expect, it } from "vitest";
import { DIVE_TIMING, deepestPoint, diveFrame } from "./diveOrigin";

function mask(w: number, h: number, fill: (x: number, y: number) => boolean) {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = fill(x, y) ? 1 : 0;
  return m;
}

describe("deepestPoint", () => {
  it("picks the centre of the thickest stroke, not a thin one", () => {
    // a 2px bar at x=2..3 and a 10x10 block at x=8..17, y=5..14
    const m = mask(20, 20, (x, y) => (x >= 2 && x <= 3) || (x >= 8 && x <= 17 && y >= 5 && y <= 14));
    const p = deepestPoint(m, 20, 20)!;
    expect(p.x).toBeGreaterThanOrEqual(10);
    expect(p.x).toBeLessThanOrEqual(15);
    expect(p.y).toBeGreaterThanOrEqual(7);
    expect(p.y).toBeLessThanOrEqual(12);
    expect(p.radius).toBeGreaterThanOrEqual(4);
  });
  it("returns null for an empty mask or a zero-size box", () => {
    expect(deepestPoint(new Uint8Array(16), 4, 4)).toBeNull();
    expect(deepestPoint(new Uint8Array(0), 0, 0)).toBeNull();
  });
});

describe("diveFrame", () => {
  const cover = 10;
  it("starts at scale 1, fully opaque", () => {
    expect(diveFrame(0, cover)).toEqual({ scale: 1, opacity: 1, done: false });
  });
  it("pulls back to 0.965 at the end of the anticipation", () => {
    expect(diveFrame(DIVE_TIMING.pre, cover).scale).toBeCloseTo(0.965, 3);
  });
  it("stays opaque until the stroke covers the screen, then fades to 0", () => {
    for (let t = DIVE_TIMING.pre; t <= DIVE_TIMING.pre + DIVE_TIMING.dive; t += 50) {
      const f = diveFrame(t, cover);
      if (f.scale < cover) expect(f.opacity).toBe(1);
    }
    const end = diveFrame(DIVE_TIMING.pre + DIVE_TIMING.dive, cover);
    expect(end.scale).toBeCloseTo(cover * 2.2, 3);
    expect(end.opacity).toBe(0);
    expect(end.done).toBe(true);
  });
  it("never divides by zero for a tiny cover", () => {
    const f = diveFrame(DIVE_TIMING.pre + DIVE_TIMING.dive, 0.2);
    expect(Number.isFinite(f.scale)).toBe(true);
    expect(f.opacity).toBe(0);
  });
});
