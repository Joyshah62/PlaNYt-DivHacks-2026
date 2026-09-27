import { describe, expect, it, vi } from "vitest";
import { candidateStop, exactPlace, lookupCandidates, lookupIntent } from "./placeLookup";
import { searchGoogle, searchLocal } from "./sources";
import type { Candidate } from "./types";

vi.mock("./sources", () => ({ searchGoogle: vi.fn(), searchLocal: vi.fn() }));

const place: Candidate = { id: "g-bungalow", name: "Bungalow", lat: 40.7245, lon: -73.9896, category: "restaurant", kind: "Restaurant", cuisine: null, rating: null, reviews: null, price: null, hours: [[1020, 1320], [1020, 1320], [1020, 1320], [1020, 1320], [1020, 1320], [1020, 1380], [1020, 1380]], address: "24 1st Ave", website: null, source: "google", meters: 0 };

describe("place identity lookup", () => {
  it("retains the chef description without searching for the placement museum", async () => {
    const query = "vikas khanna's restaurant after museum";
    expect(lookupIntent(query)).toMatchObject({ category: "restaurant", searchText: query, cuisine: null });
    vi.mocked(searchGoogle).mockResolvedValueOnce([place]);
    expect(await lookupCandidates(query)).toEqual([place]);
    expect(searchGoogle).toHaveBeenLastCalledWith(expect.any(Array), expect.objectContaining({ searchText: query, category: "restaurant" }));
  });
  it("rejects unrelated and out-of-city search matches", async () => {
    vi.mocked(searchGoogle).mockResolvedValueOnce([{ ...place, name: "Bungalow Bar" }]);
    expect(await exactPlace("Bungalow")).toBeNull();
    vi.mocked(searchGoogle).mockResolvedValueOnce([{ ...place, lat: 34, lon: -118 }]);
    expect(await exactPlace("Bungalow")).toBeNull();
  });
  it("requires a choice when more than one branch matches", async () => {
    vi.mocked(searchGoogle).mockResolvedValueOnce([place, { ...place, id: "another-branch", address: "Another street" }]);
    expect(await exactPlace("Bungalow")).toBeNull();
  });
  it("preserves the provider's name, coordinates and opening hours", async () => {
    vi.mocked(searchGoogle).mockResolvedValueOnce([place]);
    const match = await exactPlace("Bungalow New York");
    expect(match).toEqual(place);
    expect(candidateStop(match!, 90)).toMatchObject({ name: "Bungalow", lat: place.lat, lon: place.lon, hours: place.hours, visitMin: 90 });
  });
  it("can use an exact local listing when Google is unavailable", async () => {
    vi.mocked(searchGoogle).mockResolvedValueOnce(null);
    vi.mocked(searchLocal).mockResolvedValueOnce([{ ...place, source: "openstreetmap" }]);
    expect((await exactPlace("Bungalow"))?.source).toBe("openstreetmap");
  });
});
