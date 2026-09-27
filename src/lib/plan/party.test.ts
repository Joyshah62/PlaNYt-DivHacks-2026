import { describe, expect, it } from "vitest";
import { itinerary } from "@/lib/imessage/format";
import type { DayBudget } from "./budget";
import { defaultSettings, fromAssistant } from "./fromAssistant";
import { DEFAULT_PROFILE, partySize } from "./profile";
import type { AssistantResult, DayPlan } from "./types";
import { partyFromText } from "./party";

const result = (profile: AssistantResult["profile"]): AssistantResult => ({
  stops: [], unresolved: [], date: null, startMin: null, endMin: null, mode: null, crowd: null, origin: null, profile, meals: {}, choices: [], reply: "",
});

describe("how many are going", () => {
  it.each(["I want to see two museums", "I'm a student, show me NYC", "We want pizza", "With friends tomorrow", "I have $50 for dinner", "I'm 21 and want a fun day"])("does not invent a party for %s", (text) => {
    expect(partyFromText(text)).toEqual({});
  });
  it("understands explicit headcounts without calling friends a couple", () => {
    expect(partyFromText("There are four of us")).toEqual({ people: 4 });
    expect(partyFromText("a family of five")).toEqual({ group: "family", people: 5 });
    expect(partyFromText("the two of us")).toEqual({ people: 2 });
    expect(partyFromText("just me")).toEqual({ group: "solo", people: 1 });
    expect(partyFromText("with my two kids")).toEqual({ group: "family", people: 3 });
    expect(partyFromText("with my kids")).toEqual({ group: "family" });
  });
  it("counts what they said, else what the group means", () => {
    expect(partySize(DEFAULT_PROFILE)).toBeNull();
    expect(partySize({ group: "couple" })).toBe(2);
    expect(partySize({ group: "family" })).toBeNull();
    expect(partySize({ group: "family", people: 4 })).toBe(4);
  });

  it("takes each day's count from its own request, never from an earlier trip", () => {
    const settings = defaultSettings("2026-09-26");
    const family = fromAssistant(result({ group: "family", people: 5 }), settings, DEFAULT_PROFILE);
    expect(family.profile.people).toBe(5);
    // "I'm a student…" read without a group or count: the old 5 must not carry over.
    const next = fromAssistant(result({ pace: "relaxed" }), settings, family.profile);
    expect(next.profile).not.toHaveProperty("people");
    expect(next.profile.group).toBe("unspecified");
    expect(next.profileChanged).toBe(true);
    expect(fromAssistant(result({}), settings, { ...DEFAULT_PROFILE, people: 5 }).profile.people).toBeUndefined();
    expect(fromAssistant(result({ group: "solo" }), settings, family.profile).profile.people).toBe(1);
    expect(fromAssistant(result({ group: "seniors" }), settings, family.profile).profile).not.toHaveProperty("people");
  });

  it("texts the total for everyone, with the price each", () => {
    const plan = { request: { date: "2026-09-27", startMin: 540, origin: null }, stops: [], skipped: [], returnLeg: null, summary: { finishMin: 600, travelMin: 0 } } as unknown as DayPlan;
    const budget = { perPerson: 40, lines: [], transit: { rides: 0, fare: 3, total: 0, note: null }, unknown: 0 } as DayBudget;
    expect(itinerary(plan, { budget, people: 3 })).toContain("About $120 for 3 people ($40 each)");
    expect(itinerary(plan, { budget, people: 1 })).toContain("About $40 for you");
    expect(itinerary(plan, { budget, people: null })).toContain("About $40 per person");
  });
});
