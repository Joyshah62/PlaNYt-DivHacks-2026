import { describe, expect, it } from "vitest";
import { oneMealEach } from "./oneMeal";

const stop = (query: string, meal: "lunch" | "dinner" | null, extra: { fixedTime?: string; why?: string } = {}) => ({
  attractionId: null, query, meal, fixedTime: extra.fixedTime ?? null, wish: null, why: extra.why ?? null, alternatives: [] as { attractionId: string | null; query: string; why: string }[],
});

describe("one place per meal", () => {
  it("keeps the first dinner and offers the rest as alternatives", () => {
    const out = oneMealEach([stop("One World Observatory", null), stop("Le Bernardin", "dinner"), stop("Daniel", "dinner", { why: "French classic" }), stop("Eleven Madison Park", "dinner")]);
    expect(out.map((s) => s.query)).toEqual(["One World Observatory", "Le Bernardin"]);
    expect(out[1].wish).toBe("Dinner");
    expect(out[1].alternatives.map((a) => [a.query, a.why])).toEqual([["Daniel", "French classic"], ["Eleven Madison Park", "Another dinner pick"]]);
  });
  it("leaves a lunch and a dinner, and a booked table, alone", () => {
    const out = oneMealEach([stop("Joe's Pizza", "lunch"), stop("Carbone", "dinner"), stop("Rao's", "dinner", { fixedTime: "20:00" })]);
    expect(out.map((s) => s.query)).toEqual(["Joe's Pizza", "Carbone", "Rao's"]);
  });
});
