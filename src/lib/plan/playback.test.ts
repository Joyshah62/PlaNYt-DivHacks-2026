import { describe, expect, it } from "vitest";
import { along, positionAt, type Timeline } from "./playback";

const timeline: Timeline = {
  startMin: 600,
  endMin: 780,
  segments: [
    { from: 600, to: 660, key: "a", toward: null, label: "At A", path: [[0, 0]] },
    { from: 660, to: 680, key: null, toward: "b", label: "Walking to B", path: [[0, 0], [0, 0.01], [0.01, 0.01]] },
    { from: 690, to: 780, key: "b", toward: null, label: "At B", path: [[0.01, 0.01]] },
  ],
};

describe("playback", () => {
  it("walks along a path by distance", () => {
    const { at, done } = along([[0, 0], [0, 1], [0, 3]], 0.5);
    expect(at[1]).toBeCloseTo(1.5);
    expect(done).toHaveLength(3);
  });

  it("stays at a stop, travels between stops, and leaves a trail", () => {
    expect(positionAt(timeline, 630)).toMatchObject({ key: "a", at: [0, 0], trail: [] });
    const mid = positionAt(timeline, 670)!;
    expect(mid.key).toBe("b");
    expect(mid.label).toBe("Walking to B");
    expect(mid.at[1]).toBeCloseTo(0.01, 3);
    expect(mid.trail).toHaveLength(1);
  });

  it("waits where the last segment ended during a gap, and ends at the last stop", () => {
    expect(positionAt(timeline, 685)!.at).toEqual([0.01, 0.01]);
    expect(positionAt(timeline, 900)!.at).toEqual([0.01, 0.01]);
  });
});
