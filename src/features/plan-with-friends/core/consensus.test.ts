import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, type PlanRequest } from "../bridge/index";
import { consensus, draftSignature } from "./consensus";

const draft: PlanRequest = {
  stops: [
    { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, visitMin: 150, attractionId: "met" },
    { key: "moma", name: "MoMA", lat: 40.7614, lon: -73.9776, visitMin: 120, attractionId: "moma" },
  ],
  date: "2026-10-03",
  startMin: 600,
  endMin: 1260,
  mode: "transit",
  crowd: "avoid",
  origin: null,
  returnToOrigin: false,
  profile: DEFAULT_PROFILE,
  meals: { lunch: false, dinner: false },
};
const sig = draftSignature(draft);
const base = { members: ["a", "b", "c"], draft };

describe("draftSignature", () => {
  it("is stable for identical requests", () => {
    expect(draftSignature(structuredClone(draft))).toBe(sig);
  });

  it("changes when the stops' order or the settings change", () => {
    expect(draftSignature({ ...draft, stops: [...draft.stops].reverse() })).not.toBe(sig);
    expect(draftSignature({ ...draft, startMin: 660 })).not.toBe(sig);
  });
});

describe("consensus", () => {
  it("says when everyone asked is in, without locking anything", () => {
    const c = consensus({ ...base, confirmations: { a: sig, b: sig, c: sig } });
    expect(c).toMatchObject({ reason: "everyone-in", confirmed: ["a", "b", "c"], pending: [], total: 3 });
    expect(c).not.toHaveProperty("shouldLock");
  });

  it("waits on whoever hasn't said I'm in", () => {
    const c = consensus({ ...base, confirmations: { a: sig, b: sig } });
    expect(c).toMatchObject({ reason: "waiting", pending: ["c"] });
  });

  it("marks confirmations of an earlier day as stale", () => {
    const c = consensus({ ...base, confirmations: { a: sig, b: "old" } });
    expect(c).toMatchObject({ confirmed: ["a"], stale: ["b"], pending: ["b", "c"] });
  });

  it("has nothing to confirm without a day", () => {
    const c = consensus({ ...base, draft: null, confirmations: {} });
    expect(c).toMatchObject({ reason: "no-draft", signature: null, confirmed: [] });
  });

  it("is everyone-in for a host alone, who has no one to wait on", () => {
    expect(consensus({ members: [], draft, confirmations: {} })).toMatchObject({ reason: "everyone-in", total: 0 });
  });
});
