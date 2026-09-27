import { describe, expect, it } from "vitest";
import { itinerary } from "@/lib/imessage/format";
import type { DayBudget } from "./budget";
import { defaultSettings, fromAssistant } from "./fromAssistant";
import { DEFAULT_PROFILE, partySize } from "./profile";
import type { AssistantResult, DayPlan } from "./types";

const result = (profile: AssistantResult["profile"]): AssistantResult => ({
  stops: [], unresolved: [], date: null, startMin: null, endMin: null, mode: null, crowd: null, origin: null, profile, meals: {}, choices: [], reply: "",
});

describe("how many are going", () => {
  it("counts what they said, else what the group means", () => {
    expect(partySize(DEFAULT_PROFILE)).toBe(1);
    expect(partySize({ group: "couple" })).toBe(2);
    expect(partySize({ group: "family" })).toBeNull();
    expect(partySize({ group: "family", people: 4 })).toBe(4);
  });

  it("keeps a count they gave, and drops an old one when the group changes", () => {
    const settings = defaultSettings("2026-09-26");
    const family = fromAssistant(result({ group: "family", people: 4 }), settings, DEFAULT_PROFILE).profile;
    expect(family.people).toBe(4);
    // A new request that doesn't mention who's going keeps the count.
    expect(fromAssistant(result({ pace: "relaxed" }), settings, family).profile.people).toBe(4);
    expect(fromAssistant(result({ group: "solo" }), settings, family).profile.people).toBe(1);
    expect(fromAssistant(result({ group: "seniors" }), settings, family).profile).not.toHaveProperty("people");
  });

  it("texts the total for everyone, with the price each", () => {
    const plan = { request: { date: "2026-09-27", startMin: 540, origin: null }, stops: [], skipped: [], returnLeg: null, summary: { finishMin: 600, travelMin: 0 } } as unknown as DayPlan;
    const budget = { perPerson: 40, lines: [], transit: { rides: 0, fare: 3, total: 0, note: null }, unknown: 0 } as DayBudget;
    expect(itinerary(plan, { budget, people: 3 })).toContain("About $120 for 3 people ($40 each)");
    expect(itinerary(plan, { budget, people: 1 })).toContain("About $40 for you");
    expect(itinerary(plan, { budget, people: null })).toContain("About $40 per person");
  });
});
