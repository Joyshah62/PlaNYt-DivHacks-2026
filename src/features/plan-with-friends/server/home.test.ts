import { describe, expect, it } from "vitest";
import { homePlanFor } from "./home";

describe("homePlanFor", () => {
  it("gives a Queens ride home a real subway option and a pricier taxi", () => {
    const plan = homePlanFor({ lat: 40.7527, lon: -73.9772 }, { lat: 40.775, lon: -73.912 }, 20 * 60);
    const subway = plan.options.find((o) => o.mode === "subway");
    const taxi = plan.options.find((o) => o.mode === "taxi")!;
    expect(subway?.minutes).toBeGreaterThan(10);
    expect(subway?.minutes).toBeLessThan(70);
    expect(taxi.cost).toBeGreaterThan(10);
    expect(["subway", "bike", "taxi"]).toContain(plan.best);
  });

  it("says walk for a place around the corner", () => {
    expect(homePlanFor({ lat: 40.7527, lon: -73.9772 }, { lat: 40.7535, lon: -73.978 }, 18 * 60).best).toBe("walk");
  });
});
