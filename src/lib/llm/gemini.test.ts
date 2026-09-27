import { afterEach, describe, expect, it, vi } from "vitest";
import { GEMINI_FALLBACK_MODEL, GEMINI_MODEL, geminiChat, geminiJson } from "./gemini";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const answer = (content: string) => Response.json({ choices: [{ message: { content } }] });

describe("Gemini", () => {
  it("uses Google's endpoint and preserves signed tool calls for the next turn", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    const tool = { id: "call-1", type: "function", function: { name: "add_place", arguments: '{"startMin":1140}' }, extra_content: { google: { thought_signature: "signature" } } };
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ choices: [{ message: { role: "assistant", content: null, tool_calls: [tool] } }] })).mockResolvedValueOnce(answer("Done"));
    vi.stubGlobal("fetch", fetch);
    const first = await geminiChat({ messages: [{ role: "user", content: "Dinner at 7pm" }] });
    expect(first.calls[0].args).toEqual({ startMin: 1140 });
    await geminiChat({ messages: [first.message, { role: "tool", tool_call_id: "call-1", content: "Scheduled" }] });
    expect(fetch.mock.calls[0][0]).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    const sent = JSON.parse(fetch.mock.calls[1][1].body);
    expect(sent.model).toBe(GEMINI_MODEL);
    expect(sent.messages[0].tool_calls[0]).toEqual(tool);
  });

  it("retries the configured Gemini model when a call stalls", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    const stall = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    const fetch = vi.fn().mockRejectedValueOnce(stall).mockResolvedValueOnce(answer('{"stops":["The Met"]}'));
    vi.stubGlobal("fetch", fetch);
    expect(await geminiJson("system", "the Met", { name: "t", schema: {} }, { effort: "low" })).toEqual({ stops: ["The Met"] });
    const models = fetch.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
    expect(models.map((b) => b.model)).toEqual([GEMINI_MODEL, GEMINI_FALLBACK_MODEL]);
    // The retry allows the model to use its default reasoning setting.
    expect(models[0].reasoning_effort).toBe("low");
    expect(models[1].reasoning_effort).toBeUndefined();
  });

  it("doesn't retry a bad key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    const fetch = vi.fn(async () => new Response("bad key", { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    await expect(geminiJson("system", "the Met", { name: "t", schema: {} })).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("models that don't take a reasoning effort", () => {
  it("asks again without one, and remembers", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      if (body.reasoning_effort) return new Response('{"error":"Model gemini-x does not support parameter reasoningEffort."}', { status: 400 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
    }));
    const { geminiChat } = await import("./gemini");
    expect((await geminiChat({ messages: [{ role: "user", content: "hi" }], effort: "low", model: "gemini-x" })).text).toBe("ok");
    expect((await geminiChat({ messages: [{ role: "user", content: "hi" }], effort: "low", model: "gemini-x" })).text).toBe("ok");
    expect(bodies.map((b) => "reasoning_effort" in b)).toEqual([true, false, false]);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
