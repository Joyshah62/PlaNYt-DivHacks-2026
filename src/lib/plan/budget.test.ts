import { describe, expect, it } from "vitest";
import { assembleBudget, money, partyTotal, priceKindOf, SUBWAY_FARE } from "./budget";
import type { DayPlan } from "./types";

const stop = (key: string, name: string, attractionId: string | null, leg: "walk" | "subway" | null, extra = {}) => ({
  key, name, attractionId, lat: 40.7, lon: -73.9, visitMin: 60, arriveMin: 0, startMin: 0, endMin: 0, waitMin: 0, window: "always", issue: null, crowd: null, meal: null, nearbyFood: null,
  leg: leg ? { mode: leg, minutes: 10, meters: 800, estimated: false } : null, ...extra,
});
const plan = (group: "solo" | "couple", mode: "transit" | "car" = "transit") => ({
  request: { mode, profile: { group } },
  stops: [
    stop("met", "The Met", "met", null),
    stop("central-park", "Central Park", "central-park", "walk"),
    stop("meal-lunch", "Lunch", null, null, { meal: "lunch" }),
    stop("place-joes", "Joe's Pizza", null, "subway"),
    stop("place-mystery", "Mystery Exhibit", null, "subway"),
  ],
  returnLeg: null,
}) as unknown as DayPlan;

describe("the day's budget", () => {
  const prices = new Map([
    ["met", { perPerson: 30, free: false, bookAhead: false, note: "Pay what you wish for NY residents", url: "https://www.metmuseum.org" }],
    ["place-joes", { perPerson: null, free: false, bookAhead: false, note: null, url: null }],
    ["place-mystery", null],
  ]);

  it("adds tickets, meals and subway rides, and says what's estimated or unknown", () => {
    const b = assembleBudget(plan("solo"), prices);
    expect(b.lines.map((l) => [l.name, money(l)])).toEqual([["The Met", "$30"], ["Central Park", "Free"], ["Lunch", "~$25"], ["Joe's Pizza", "~$20"], ["Mystery Exhibit", "Price unknown"]]);
    expect(b.transit).toMatchObject({ rides: 2, total: 2 * SUBWAY_FARE });
    expect(b.perPerson).toBe(30 + 25 + 20 + 2 * SUBWAY_FARE);
    expect(b.unknown).toBe(1);
  });
  it("totals for the party, and says driving isn't counted", () => {
    const b = assembleBudget(plan("couple", "car"), prices);
    expect(partyTotal(b, 2)).toBe(b.perPerson * 2);
    expect(b.transit.note).toMatch(/Driving/);
  });
  it("knows parks and neighborhoods are free and cafés are food", () => {
    expect(priceKindOf({ attractionId: "central-park", name: "Central Park" })).toBe("free");
    expect(priceKindOf({ attractionId: null, name: "Blue Bottle Coffee" })).toBe("food");
    expect(priceKindOf({ attractionId: null, name: "The Vessel" })).toBe("ticket");
  });
});
