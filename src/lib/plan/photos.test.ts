import { afterEach, expect, it, vi } from "vitest";
import { reserve } from "@/lib/google/quota";

vi.mock("@/lib/google/quota", () => ({ reserve: vi.fn(), release: vi.fn(), usageReport: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("recovers after a quota pause without caching the missing photo for six hours", async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "test");
  vi.mocked(reserve).mockResolvedValueOnce(false).mockResolvedValue(true);
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({ query: { pages: [] } }))
    .mockResolvedValueOnce(Response.json({ places: [{ photos: [{ name: "places/bakery/photos/one", authorAttributions: [{ displayName: "Photographer", uri: "https://example.com/credit" }] }] }] }))
    .mockResolvedValueOnce(Response.json({ photoUri: "https://example.com/photo.jpg" }));
  vi.stubGlobal("fetch", fetch);
  const { photoFor } = await import("./photos");
  const place = { attractionId: null, name: "Bakery", lat: 40.78, lon: -73.98 };
  expect(await photoFor(place)).toBeNull();
  expect(await photoFor(place)).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(61_000);
  const photo = await photoFor(place);
  expect(photo).toMatchObject({ source: "google", credit: "Photographer", url: "https://example.com/photo.jpg" });
  expect(await photoFor(place)).toEqual(photo);
  expect(fetch).toHaveBeenCalledTimes(3);
});
