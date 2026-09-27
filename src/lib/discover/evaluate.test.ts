import { describe, expect, it } from "vitest";
import { ratingText, scoreOf, weightedRating } from "./evaluate";
import { fallbackIntent, fallbackWithPlan } from "./intent";
import type { Intent } from "./types";

const intent = fallbackIntent("korean food for dinner", null);
const base = { travelDelta: 8, overDelta: 0, conflicts: [] as string[], closed: false, crowdBand: null, meters: 300, price: null, rating: null, reviews: null, after: "Central Park" };

describe("evidence", () => {
  it("shows a rating only with its review count", () => {
    expect(ratingText({ rating: 4.6, reviews: 1240 })).toBe("4.6★ from 1,240 reviews");
    expect(ratingText({ rating: 4.6, reviews: null })).toBeNull();
    expect(ratingText({ rating: null, reviews: null })).toBeNull();
  });

  it("trusts many reviews over a perfect score from a few", () => {
    expect(weightedRating({ rating: 4.6, reviews: 2000 })!).toBeGreaterThan(weightedRating({ rating: 5, reviews: 3 })!);
  });
});

describe("ranking", () => {
  it("prefers less detour, and never a place that breaks the day", () => {
    expect(scoreOf({ ...base, travelDelta: 4 }, intent, 1, null)).toBeLessThan(scoreOf(base, intent, 1, null));
    expect(scoreOf({ ...base, conflicts: ["Hamilton would start late"] }, intent, 1, null)).toBeGreaterThan(scoreOf({ ...base, travelDelta: 30 }, intent, 1, null));
    expect(scoreOf({ ...base, closed: true }, intent, 1, null)).toBeGreaterThan(900);
  });

  it("lets well-evidenced ratings count, more so when asked for the best", () => {
    const rated = { ...base, rating: 4.7, reviews: 900 };
    expect(scoreOf(rated, intent, 1, null)).toBeLessThan(scoreOf(base, intent, 1, null));
    const best = { ...intent, sort: "rating" as const };
    expect(scoreOf(rated, best, 1, null) - scoreOf(base, best, 1, null)).toBeLessThan(scoreOf(rated, intent, 1, null) - scoreOf(base, intent, 1, null));
  });

  it("follows a refinement: closer weighs distance", () => {
    const closer = { ...intent, sort: "closer" as const };
    expect(scoreOf({ ...base, meters: 100 }, closer, 1, null)).toBeLessThan(scoreOf({ ...base, meters: 900, travelDelta: 6 }, closer, 1, null));
  });
});

describe("refining without Grok", () => {
  it("keeps the search and changes only what the follow-up says", () => {
    const next = fallbackIntent("cheaper", intent);
    expect(next).toMatchObject({ category: "restaurant", cuisine: "korean", meal: "dinner", price: "cheap", sort: "cheaper" });
    expect(fallbackIntent("closer", next).sort).toBe("closer");
  });
});

describe("reading requests without Grok", () => {
  it("knows a café when it sees one, accents and all", () => {
    expect(fallbackIntent("A quiet café after the Met", null)).toMatchObject({ category: "cafe", quiet: true });
    expect(fallbackIntent("coffee after Central Park", null).category).toBe("cafe");
  });
});

describe("reading the plan without Grok", () => {
  const plan = {
    request: { stops: [], origin: null },
    stops: [
      { key: "met", name: "The Met", meal: null },
      { key: "joes", name: "Joe's Pizza", meal: "lunch", mealFor: "lunch" },
      { key: "top-of-the-rock", name: "Top of the Rock", meal: null },
    ],
  } as unknown as Parameters<typeof fallbackWithPlan>[2];

  it("finds the stop named after 'after', 'near' and 'last stop'", () => {
    expect(fallbackWithPlan("a quiet café after the Met", null, plan).intent.after).toBe("met");
    expect(fallbackWithPlan("something fun near our last stop", null, plan).area).toEqual({ kind: "stop", stopKey: "top-of-the-rock" });
    expect(fallbackWithPlan("korean instead, replace my lunch stop", null, plan).intent.replace).toBe("joes");
  });
});

describe("ranking places by rating, popularity and travel", () => {
  const fit: Intent = { category: "shopping", cuisine: null, keywords: [], searchText: "shopping", price: null, indoor: null, quiet: false, minRating: null, visitMin: null, after: null, meal: null, replace: null, sort: "fit", summary: "shopping" };
  const place = (rating: number, reviews: number, travelDelta: number) => ({ travelDelta, overDelta: 0, conflicts: [], closed: false, crowdBand: null, meters: 300, price: null, rating, reviews, after: null });

  it("prefers a well-loved, much-reviewed place over a near-perfect score from a handful", () => {
    expect(scoreOf(place(4.8, 1085, 10), fit, 0, null)).toBeLessThan(scoreOf(place(4.9, 46, 10), fit, 0, null));
  });
  it("still lets a much longer trip outweigh a slightly better place", () => {
    expect(scoreOf(place(4.6, 300, 4), fit, 0, null)).toBeLessThan(scoreOf(place(4.7, 400, 30), fit, 0, null));
  });
});
