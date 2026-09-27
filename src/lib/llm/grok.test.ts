import { afterEach, describe, expect, it, vi } from "vitest";
import { GROK_FALLBACK_MODEL, GROK_MODEL, grokJson } from "./grok";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const answer = (content: string) => Response.json({ choices: [{ message: { content } }] });

describe("Grok", () => {
  it("answers with the fast model when the main one stalls", async () => {
    vi.stubEnv("GROK_API_KEY", "xai-test");
    const stall = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    const fetch = vi.fn().mockRejectedValueOnce(stall).mockResolvedValueOnce(answer('{"stops":["The Met"]}'));
    vi.stubGlobal("fetch", fetch);
    expect(await grokJson("system", "the Met", { name: "t", schema: {} }, { effort: "low" })).toEqual({ stops: ["The Met"] });
    const models = fetch.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
    expect(models.map((b) => b.model)).toEqual([GROK_MODEL, GROK_FALLBACK_MODEL]);
    // The fast model doesn't reason, so it's not asked to.
    expect(models[0].reasoning_effort).toBe("low");
    expect(models[1].reasoning_effort).toBeUndefined();
  });

  it("doesn't retry a bad key", async () => {
    vi.stubEnv("GROK_API_KEY", "xai-test");
    const fetch = vi.fn(async () => new Response("bad key", { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    await expect(grokJson("system", "the Met", { name: "t", schema: {} })).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
