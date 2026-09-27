import { afterEach, describe, expect, it, vi } from "vitest";
import { webSearch, webSearchEnabled } from "./tavily";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("web search", () => {
  it("is off without a key", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    expect(webSearchEnabled()).toBe(false);
    expect(await webSearch("MoMA hours")).toBeNull();
  });

  it("asks Tavily for a short answer with a few sources, and reuses it", async () => {
    vi.stubEnv("TAVILY_API_KEY", "tvly-test");
    const fetch = vi.fn(async () => Response.json({ answer: "MoMA is free on Friday evenings.", results: [{ title: "MoMA", url: "https://www.moma.org/visit", content: "UNIQLO Free Friday Nights, 5:30–9pm." }, { title: "no url" }] }));
    vi.stubGlobal("fetch", fetch);
    const found = await webSearch("MoMA free Friday", { recent: true });
    expect(found).toEqual({ answer: "MoMA is free on Friday evenings.", results: [{ title: "MoMA", url: "https://www.moma.org/visit", content: "UNIQLO Free Friday Nights, 5:30–9pm." }] });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: "Bearer tvly-test" });
    expect(JSON.parse(init.body as string)).toMatchObject({ query: "MoMA free Friday", search_depth: "basic", max_results: 5, time_range: "month", exclude_domains: expect.arrayContaining(["facebook.com", "instagram.com"]) });
    await webSearch("moma free friday", { recent: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives nothing rather than failing when Tavily errors", async () => {
    vi.stubEnv("TAVILY_API_KEY", "tvly-test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad key", { status: 401 })));
    expect(await webSearch("Top of the Rock tickets")).toBeNull();
  });
});
