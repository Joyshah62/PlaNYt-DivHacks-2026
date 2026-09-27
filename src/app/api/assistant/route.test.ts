import { beforeEach, describe, expect, it, vi } from "vitest";
import { geminiJson } from "@/lib/llm/gemini";
import { POST } from "./route";
import { readProgress } from "@/lib/progress";
import { webSearch } from "@/lib/web/tavily";

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/memory/traveler", () => ({ travelerMemory: vi.fn(async () => ({ memoryId: null, onAccount: false })) }));
vi.mock("@/lib/memory/backboard", () => ({ recall: vi.fn(async () => []), rememberedFacts: () => "", remember: vi.fn() }));
vi.mock("@/lib/web/tavily", () => ({ webSearchEnabled: () => true, webSearch: vi.fn(async () => ({ answer: "Fans visit 90 Bedford Street and Cherry Hill Fountain.", results: [{ title: "Friends NYC", url: "https://example.com", content: "90 Bedford St; Cherry Hill Fountain is the look-alike." }] })) }));
vi.mock("@/lib/llm/gemini", async (original) => ({ ...await original<typeof import("@/lib/llm/gemini")>(), geminiKey: () => "test", geminiJson: vi.fn() }));

const interpreted = {
  stops: [{ attractionId: "times-square", query: "Times Square", visitMin: null, fixedTime: null, meal: null, nearMe: false, wish: null, why: null, alternatives: [] }],
  date: "2099-10-03", startTime: null, endTime: null, mode: null, crowd: null, origin: null,
  pace: null, group: "family", people: 5, walkMax: null, interests: null, lunch: null, dinner: null, reply: "Times Square is in your day.",
};

beforeEach(() => { vi.mocked(geminiJson).mockResolvedValue(structuredClone(interpreted)); });

describe("assistant party evidence and progress", () => {
  it("rejects guessed party fields even if the model returns them", async () => {
    const response = await POST(new Request("https://local/api/assistant", { method: "POST", body: JSON.stringify({ text: "I want Times Square", skipQuestions: true, profile: { group: "family", people: 5 } }) }));
    const result = await response.json();
    expect(result.profile).not.toHaveProperty("group");
    expect(result.profile).not.toHaveProperty("people");
    const prompt = vi.mocked(geminiJson).mock.calls.at(-1)![1];
    expect(prompt).not.toContain('"people":5');
    expect(prompt).not.toContain('"group":"family"');
  });
  it("asks who's coming instead of treating any stored profile as an answer", async () => {
    const response = await POST(new Request("https://local/api/assistant", { method: "POST", body: JSON.stringify({ text: "I want Times Square", knowsGroup: true, profile: { group: "solo" } }) }));
    const result = await response.json();
    expect(result.questions.map((q: { id: string }) => q.id)).toContain("who");
  });
  it("keeps an explicit number and streams stages before the result", async () => {
    const stages = vi.fn();
    const response = await POST(new Request("https://local/api/assistant", { method: "POST", headers: { accept: "application/x-ndjson" }, body: JSON.stringify({ text: "Times Square for four people", skipQuestions: true }) }));
    const result = await readProgress<{ profile: object }>(response, stages);
    expect(result.profile).toEqual({ people: 4 });
    expect(stages.mock.calls.flat()).toContain("Working out your day…");
    expect(stages.mock.calls.flat()).toContain("Finding places and checking locations…");
  });
  it("grounds a themed day in a web search before reading it for good", async () => {
    vi.mocked(geminiJson)
      .mockResolvedValueOnce({ ...structuredClone(interpreted), theme: "Friends" })
      .mockResolvedValueOnce({ ...structuredClone(interpreted), theme: "Friends", reply: "Grounded." });
    const response = await POST(new Request("https://local/api/assistant", { method: "POST", body: JSON.stringify({ text: "A Friends day, just me", skipQuestions: true }) }));
    const result = await response.json();
    expect(vi.mocked(webSearch)).toHaveBeenCalledWith(expect.stringContaining("Friends"));
    expect(vi.mocked(geminiJson).mock.calls.at(-1)![1]).toContain("Cherry Hill Fountain");
    expect(result.reply).toBe("Grounded.");
  });
});
