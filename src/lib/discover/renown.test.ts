import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Candidate } from "./types";

const geminiJson = vi.fn();
vi.mock("@/lib/mongo", () => ({ hasMongo: () => false, getDb: vi.fn() }));
vi.mock("@/lib/llm/gemini", () => ({ geminiKey: () => "test", geminiJson: (...args: unknown[]) => geminiJson(...args) }));
const { renownOf, renownText } = await import("./renown");

const place = (id: string, name: string, rating: number | null = null): Candidate => ({
  id, name, lat: 40.72, lon: -73.99, category: "restaurant", kind: "Deli", cuisine: null, rating, reviews: rating ? 100 : null, price: null, hours: null, address: null, website: null, source: "openstreetmap", meters: 100,
});

describe("renown", () => {
  beforeEach(() => {
    geminiJson.mockReset();
  });

  it("grades only unrated places, clamps odd answers, and remembers them", async () => {
    geminiJson.mockResolvedValue({ grades: [{ i: 0, renown: 3 }, { i: 1, renown: 9 }, { i: 7, renown: 2 }] });
    const r = await renownOf([place("a", "Katz's Delicatessen"), place("b", "Corner Deli"), place("c", "Rated Spot", 4.5)]);
    expect(r.get("a")).toBe(3);
    expect(r.get("b")).toBe(3);
    expect(r.has("c")).toBe(false);
    expect(geminiJson.mock.calls[0][1]).not.toContain("Rated Spot");

    const again = await renownOf([place("a", "Katz's Delicatessen")]);
    expect(again.get("a")).toBe(3);
    expect(geminiJson).toHaveBeenCalledTimes(1);
  });

  it("carries on without grades when Gemini fails", async () => {
    geminiJson.mockImplementation(async () => { throw new Error("down"); });
    expect((await renownOf([place("z", "Somewhere")])).size).toBe(0);
  });

  it("says famous in words a card can show", () => {
    expect(renownText(3)).toBe("A New York favorite");
    expect(renownText(0)).toBeNull();
  });
});
