import { describe, expect, it } from "vitest";
import { planToIcs } from "./ics";
import type { DayPlan } from "./types";

const plan = {
  request: { date: "2026-10-10", origin: null },
  stops: [
    { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, attractionId: "met", startMin: 600, endMin: 750, arriveMin: 600, leg: null, meal: null },
    { key: "meal-lunch", name: "Lunch", lat: 40.7794, lon: -73.9632, attractionId: null, startMin: 750, endMin: 810, arriveMin: 750, leg: null, meal: "lunch" },
  ],
} as unknown as DayPlan;

describe("calendar export", () => {
  it("writes one event per stop in New York time", () => {
    const ics = planToIcs(plan, "https://roam.example/plan?plan=x");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("DTSTART;TZID=America/New_York:20261010T100000");
    expect(ics).toContain("DTEND;TZID=America/New_York:20261010T123000");
    expect(ics).toContain("SUMMARY:The Met");
    expect(ics).toContain("LOCATION:The Met\\, Upper East Side\\, New York\\, NY");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});
