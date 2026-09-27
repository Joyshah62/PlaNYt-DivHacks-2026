import { beforeEach, describe, expect, it, vi } from "vitest";

const webSearch = vi.fn();
const geminiChat = vi.fn();
vi.mock("@/lib/web/tavily", () => ({ webSearchEnabled: () => true, webSearch: (...a: unknown[]) => webSearch(...a) }));
vi.mock("@/lib/llm/gemini", () => ({ geminiKey: () => "test", geminiChat: (...a: unknown[]) => geminiChat(...a) }));
const answer = (value: unknown) => ({ text: JSON.stringify(value), calls: [], message: { role: "assistant", content: null } });
vi.mock("./time", async (original) => ({ ...(await original<typeof import("./time")>()), nycToday: () => "2026-09-27" }));
const { dateMention, liveAlerts } = await import("./liveAlerts");

const results = [
  { title: "Steuben Parade 2026", url: "https://example.org/steuben", content: "The parade marches up Fifth Avenue from 68th to 86th St on Saturday, October 3." },
  { title: "Weekend events", url: "https://example.org/weekend", content: "Street fairs on Oct. 3 across Manhattan." },
  { title: "Some other day", url: "https://example.org/other", content: "A parade on October 30." },
];

describe("live alerts", () => {
  beforeEach(() => {
    webSearch.mockReset();
    geminiChat.mockReset();
  });

  it("keeps only alerts a search result backs, tied to the day's places", async () => {
    webSearch.mockResolvedValue({ answer: null, results });
    geminiChat.mockResolvedValue(answer({
      alerts: [
        { title: "Parade on Fifth Avenue", detail: "The Steuben Parade runs past the Met from noon; expect closed crossings.", place: "The Met", source: 1 },
        { title: "Made up", detail: "No page says this.", place: "The Met", source: 9 },
        { title: "Busy weekend", detail: "Lots going on.", place: "Somewhere else", source: 2 },
      ],
    }));
    const alerts = await liveAlerts("2026-10-03", ["The Met", "MoMA"]);
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toMatchObject({ place: "The Met", source: { url: "https://example.org/steuben" } });
    expect(alerts[1].place).toBe("Citywide");
    // The page about October 30 never reached the model.
    expect(geminiChat.mock.calls[0][0].messages[1].content).not.toContain("example.org/other");
  });

  it("doesn't search for past days or ones more than a week out, and remembers what it found", async () => {
    expect(await liveAlerts("2026-09-20", ["The Met"])).toEqual([]);
    expect(await liveAlerts("2026-10-30", ["The Met"])).toEqual([]);
    expect(webSearch).not.toHaveBeenCalled();

    webSearch.mockResolvedValue({ answer: null, results });
    // No page mentions September 29: answered without asking the model, and remembered.
    await liveAlerts("2026-09-29", ["Central Park"]);
    await liveAlerts("2026-09-29", ["Central Park"]);
    expect(geminiChat).not.toHaveBeenCalled();
    expect(webSearch).toHaveBeenCalledTimes(2);
  });

  it("recognizes the ways pages write a date, and not its neighbours", () => {
    const oct3 = dateMention("2026-10-03");
    for (const t of ["Saturday, October 3", "Oct. 3, 1-4pm", "on 3 October", "10/3 only", "Oct 3rd"]) expect(oct3.test(t)).toBe(true);
    for (const t of ["October 30", "Oct. 31", "10/30", "November 3"]) expect(oct3.test(t)).toBe(false);
  });
});
