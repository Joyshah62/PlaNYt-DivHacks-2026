import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryFor, recall, remember, rememberedFacts } from "./backboard";

const ID = "f9326f62-08a9-40ee-8b39-4af387c8a157";
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("BACKBOARD_API_KEY", "test-key");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});
const answer = (body: unknown, status = 200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
const sent = (i = 0) => ({ url: fetchMock.mock.calls[i][0] as string, body: JSON.parse(fetchMock.mock.calls[i][1].body) });

describe("memory", () => {
  it("does nothing without a key", async () => {
    vi.stubEnv("BACKBOARD_API_KEY", "");
    expect(await memoryFor(null)).toBeNull();
    expect(await recall(ID, "dinner")).toEqual([]);
    await remember(ID, "we're vegetarian");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a traveler's id and starts one for a new traveler", async () => {
    expect(await memoryFor(ID)).toBe(ID);
    answer({ assistant_id: ID });
    expect(await memoryFor("not-an-id")).toBe(ID);
    expect(sent().url).toMatch(/\/assistants$/);
    expect(sent().body.custom_fact_extraction_prompt).toContain("lasting facts");
  });

  it("finds facts best first, and answers without them when Backboard fails", async () => {
    answer({ memories: [{ content: "Staying at the Ace Hotel", score: 0.7 }, { content: "Vegetarian", score: 0.9 }] });
    expect(await recall(ID, "dinner")).toEqual(["Vegetarian", "Staying at the Ace Hotel"]);
    expect(sent().url).toContain(`/assistants/${ID}/memories/search`);
    answer({ detail: "down" }, 500);
    expect(await recall(ID, "dinner")).toEqual([]);
    expect(await recall("../other", "dinner")).toEqual([]);
  });

  it("hands their words over for facts without asking a model", async () => {
    answer({ status: "COMPLETED" });
    await remember(ID, "we're vegetarian");
    expect(sent().body).toMatchObject({ assistant_id: ID, content: "we're vegetarian", memory: "Auto", send_to_llm: "false" });
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(remember(ID, "hi")).resolves.toBeUndefined();
  });

  it("writes facts into the prompt only when there are some", () => {
    expect(rememberedFacts([])).toBe("");
    expect(rememberedFacts(["Vegetarian"])).toContain("- Vegetarian");
  });
});
