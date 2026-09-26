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
const NOW = 1_000_000;
const base = { members: ["a", "b", "c"], draft, deadline: null, now: NOW };

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
  it("locks when everyone confirmed the current draft", () => {
    const c = consensus({ ...base, confirmations: { a: sig, b: sig, c: sig } });
    expect(c).toMatchObject({ shouldLock: true, reason: "unanimous", confirmed: ["a", "b", "c"], pending: [], needed: 3 });
  });

  it("waits while someone hasn't confirmed, and lists them", () => {
    const c = consensus({ ...base, confirmations: { a: sig, b: sig } });
    expect(c).toMatchObject({ shouldLock: false, reason: "waiting", pending: ["c"] });
  });

  it("ignores confirmations of an older draft", () => {
    const c = consensus({ ...base, confirmations: { a: sig, b: sig, c: "old-signature" } });
    expect(c.shouldLock).toBe(false);
    expect(c.confirmed).toEqual(["a", "b"]);
    expect(c.stale).toEqual(["c"]);
  });

  it("lets a majority lock once the deadline has passed", () => {
    const c = consensus({ ...base, deadline: NOW - 1, confirmations: { a: sig, b: sig } });
    expect(c).toMatchObject({ shouldLock: true, reason: "majority-after-deadline", needed: 2, deadlinePassed: true });
  });

  it("needs more than half after the deadline, not exactly half", () => {
    const c = consensus({ ...base, members: ["a", "b", "c", "d"], deadline: NOW - 1, confirmations: { a: sig, b: sig } });
    expect(c).toMatchObject({ shouldLock: false, needed: 3 });
  });

  it("still needs everyone before the deadline", () => {
    const c = consensus({ ...base, deadline: NOW + 60_000, confirmations: { a: sig, b: sig } });
    expect(c).toMatchObject({ shouldLock: false, needed: 3, deadlinePassed: false });
  });

  it("never locks without a draft", () => {
    const c = consensus({ ...base, draft: null, confirmations: { a: sig, b: sig, c: sig } });
    expect(c).toMatchObject({ shouldLock: false, reason: "no-draft", signature: null, confirmed: [] });
  });
});
