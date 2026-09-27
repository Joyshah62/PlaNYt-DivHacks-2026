import { beforeEach, describe, expect, it, vi } from "vitest";

const webSearch = vi.fn();
const geminiChat = vi.fn();
vi.mock("@/lib/web/tavily", () => ({ webSearchEnabled: () => true, webSearch: (...a: unknown[]) => webSearch(...a) }));
vi.mock("@/lib/llm/gemini", () => ({ geminiKey: () => "test", geminiChat: (...a: unknown[]) => geminiChat(...a) }));
const answer = (value: unknown) => ({ text: JSON.stringify(value), calls: [], message: { role: "assistant", content: null } });
vi.mock("./time", async (original) => ({ ...(await original<typeof import("./time")>()), nycToday: () => "2026-09-27" }));
const { dateMention, liveAlerts, matchAlerts } = await import("./liveAlerts");

const steuben = { title: "Steuben Parade 2026", url: "https://example.org/steuben", content: "The parade marches up Fifth Avenue past The Met from 68th to 86th St on Saturday, October 3, from noon." };
const gridlock = { title: "Gridlock Alert days", url: "https://example.org/gridlock", content: "NYC DOT has named Oct. 3 a Gridlock Alert day; expect heavy traffic." };
const elsewhere = { title: "Bronx fair", url: "https://example.org/bronx", content: "A fair in the Bronx on October 3 with rides." };
const otherDay = { title: "Some other day", url: "https://example.org/other", content: "A parade past The Met on October 30." };

describe("live alerts", () => {
  beforeEach(() => {
    webSearch.mockReset();
    geminiChat.mockReset();
  });

  it("finds a match only where a page ties the date to a planned place, or to the whole city", () => {
    const found = matchAlerts([steuben, gridlock, elsewhere, otherDay], "2026-10-03", ["The Met", "MoMA"]);
    expect(found.map((m) => [m.result.url, m.place])).toEqual([
      ["https://example.org/steuben", "The Met"],
      ["https://example.org/gridlock", "Citywide"],
    ]);
  });

  it("asks nothing of the model when no page ties the day to the places", async () => {
    webSearch.mockResolvedValue({ answer: null, results: [elsewhere, otherDay] });
    expect(await liveAlerts("2026-10-03", ["The Met"])).toEqual([]);
    expect(geminiChat).not.toHaveBeenCalled();
  });

  it("sends the model only the matching snippets to tidy, and honors its veto", async () => {
    webSearch.mockResolvedValue({ answer: null, results: [steuben, gridlock, elsewhere] });
    geminiChat.mockResolvedValue(answer({ alerts: [{ i: 1, keep: true, title: "Parade on Fifth Avenue", detail: "The Steuben Parade passes the Met from noon." }, { i: 2, keep: false, title: "x", detail: "y" }] }));
    const alerts = await liveAlerts("2026-10-03", ["The Met", "Central Park"]);
    expect(alerts).toEqual([{ title: "Parade on Fifth Avenue", detail: "The Steuben Parade passes the Met from noon.", place: "The Met", source: { title: "Steuben Parade 2026", url: "https://example.org/steuben" } }]);
    const sent = geminiChat.mock.calls[0][0].messages[1].content as string;
    expect(sent).not.toContain("Bronx");
  });

  it("shows the page's own words when the model is slow or fails", async () => {
    webSearch.mockResolvedValue({ answer: null, results: [steuben] });
    geminiChat.mockRejectedValue(new Error("timeout"));
    // A different list of places from the tests above, so nothing comes from the cache.
    const [alert] = await liveAlerts("2026-10-03", ["The Met", "MoMA"]);
    expect(alert).toMatchObject({ title: "Steuben Parade 2026", place: "The Met", source: { url: "https://example.org/steuben" } });
    expect(alert.detail).toContain("October 3");
  });

  it("doesn't search for past days or ones more than a week out, and remembers what it found", async () => {
    expect(await liveAlerts("2026-09-20", ["The Met"])).toEqual([]);
    expect(await liveAlerts("2026-10-30", ["The Met"])).toEqual([]);
    expect(webSearch).not.toHaveBeenCalled();
    webSearch.mockResolvedValue({ answer: null, results: [] });
    await liveAlerts("2026-09-29", ["Central Park"]);
    await liveAlerts("2026-09-29", ["Central Park"]);
    expect(webSearch).toHaveBeenCalledTimes(2);
  });

  it("recognizes the ways pages write a date, and not its neighbours", () => {
    const oct3 = dateMention("2026-10-03");
    for (const t of ["Saturday, October 3", "Oct. 3, 1-4pm", "on 3 October", "10/3 only", "Oct 3rd"]) expect(oct3.test(t)).toBe(true);
    for (const t of ["October 30", "Oct. 31", "10/30", "November 3"]) expect(oct3.test(t)).toBe(false);
  });
});
