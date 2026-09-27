import { describe, expect, it } from "vitest";
import { followUps, withAnswers } from "./followUps";

// A Saturday.
const today = "2026-09-26";

describe("questions before planning", () => {
  it("asks when and who when the request says neither", () => {
    const qs = followUps({ date: null, group: null, nearMe: false }, { today, knowsGroup: false });
    expect(qs.map((q) => q.id)).toEqual(["when", "who"]);
    // Today (Sat), tomorrow (Sun), then next weekend: no day offered twice.
    expect(qs[0].choices.map((c) => c.label)).toEqual(["Today", "Tomorrow", "Sat 3", "Sun 4"]);
    expect(qs[0].choices[2].answer).toBe("going on Saturday, Oct 3 (2026-10-03)");
  });

  it("doesn't ask what's already said or known", () => {
    expect(followUps({ date: "2026-09-27", group: "family", nearMe: false }, { today, knowsGroup: false })).toEqual([]);
    expect(followUps({ date: null, group: null, nearMe: false }, { today, knowsGroup: true }).map((q) => q.id)).toEqual(["when"]);
    // "Near me" is about right now.
    expect(followUps({ date: null, group: "solo", nearMe: true }, { today, knowsGroup: false })).toEqual([]);
  });

  it("offers this weekend midweek", () => {
    const [when] = followUps({ date: null, group: "solo", nearMe: false }, { today: "2026-09-23", knowsGroup: false });
    expect(when.choices.map((c) => c.label)).toEqual(["Today", "Tomorrow", "Sat 26", "Sun 27"]);
  });

  it("adds the answers to the request", () => {
    expect(withAnswers("The Met and pizza.", ["going tomorrow", "just me"])).toBe("The Met and pizza. going tomorrow, just me.");
    expect(withAnswers("The Met", [])).toBe("The Met");
  });
});
