import { afterEach, describe, expect, it, vi } from "vitest";
import { fallbackModels, GEMINI_FALLBACK_MODEL, GEMINI_MODEL, GROK_MODEL, geminiChat, geminiJson, withFallbacks } from "./gemini";

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

  it("retries a rate limit on the fallback model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    const fetch = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 429 })).mockResolvedValueOnce(answer('{"ok":true}'));
    vi.stubGlobal("fetch", fetch);
    expect(await geminiJson("system", "the Met", { name: "t", schema: {} })).toEqual({ ok: true });
    const models = fetch.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).model);
    expect(models).toEqual([GEMINI_MODEL, GEMINI_FALLBACK_MODEL]);
    expect(GEMINI_FALLBACK_MODEL).not.toBe(GEMINI_MODEL);
  });

  it("falls back to Grok when both Gemini models fail, without Gemini's own fields", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    vi.stubEnv("GROK_API_KEY", "grok-test");
    const busy = () => new Response("busy", { status: 429 });
    const fetch = vi.fn().mockResolvedValueOnce(busy()).mockResolvedValueOnce(new Response("down", { status: 503 })).mockResolvedValueOnce(answer('{"ok":true}'));
    vi.stubGlobal("fetch", fetch);
    const signed = { id: "c1", type: "function" as const, function: { name: "t", arguments: "{}" }, extra_content: { google: { thought_signature: "s" } } };
    const reply = await withFallbacks((model) => geminiChat({ messages: [{ role: "assistant", content: null, tool_calls: [signed] }], effort: "low", model }));
    expect(reply.text).toBe('{"ok":true}');
    const [url, init] = fetch.mock.calls[2];
    expect(url).toBe("https://api.x.ai/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer grok-test" });
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.model).toBe(GROK_MODEL);
    expect(sent.reasoning_effort).toBeUndefined();
    expect(sent.messages[0].tool_calls[0]).toEqual({ id: "c1", type: "function", function: { name: "t", arguments: "{}" } });
  });

  it("stops at the Gemini fallback without a Grok key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    vi.stubEnv("GROK_API_KEY", "");
    const fetch = vi.fn(async () => new Response("busy", { status: 429 }));
    vi.stubGlobal("fetch", fetch);
    await expect(geminiJson("system", "the Met", { name: "t", schema: {} })).rejects.toMatchObject({ status: 429 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fallbackModels()).toEqual([GEMINI_FALLBACK_MODEL]);
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
