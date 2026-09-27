import { describe, expect, it, vi } from "vitest";
import { placesNear } from "./nearby";
import { searchGoogle } from "./sources";
import type { Candidate } from "./types";

vi.mock("./sources", () => ({ searchGoogle: vi.fn(), searchLocal: vi.fn(async () => null), searchOsm: vi.fn(async () => []) }));

const cafe = (name: string, meters: number, rating: number | null, reviews = 500): Candidate => ({
  id: name, name, lat: 40.8, lon: -73.96, category: "cafe", kind: "Café", cuisine: null, rating, reviews, price: null, hours: null, address: null, website: null, source: "google", meters,
});

describe("places near the traveler", () => {
  it("ranks good, close places first and leaves out far ones", async () => {
    vi.mocked(searchGoogle).mockResolvedValueOnce([cafe("Far famous", 9000, 4.9, 9000), cafe("Okay next door", 60, 3.9), cafe("Great nearby", 300, 4.7), cafe("No rating", 100, null)]);
    const found = await placesNear({ lat: 40.8075, lon: -73.9626 }, "café");
    expect(found.map((c) => c.name)).toEqual(["Great nearby", "Okay next door", "No rating"]);
    expect(searchGoogle).toHaveBeenCalledWith([{ lat: 40.8075, lon: -73.9626, radius: 800 }], expect.objectContaining({ category: "cafe" }));
  });
});
