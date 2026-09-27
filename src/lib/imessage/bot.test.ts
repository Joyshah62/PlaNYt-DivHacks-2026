import { describe, expect, it, vi } from "vitest";
import type { ChatReply } from "@/lib/discover/chat";
import { DEFAULT_PROFILE } from "@/lib/plan/profile";
import type { AssistantResult, DayPlan, PlannedStop, PlanRequest, StopInput } from "@/lib/plan/types";
import { createBot } from "./bot";
import { chatReply, normalizeHandle, parseCommand, plain } from "./format";
import { dueNudges } from "./nudges";
import type { Roam } from "./roam";
import { newThread } from "./store";

vi.mock("@/lib/plan/time", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/plan/time")>()), nycToday: () => "2026-09-26" }));

const met: StopInput = { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, attractionId: "met", visitMin: 150 };
const moma: StopInput = { key: "moma", name: "MoMA", lat: 40.7614, lon: -73.9776, attractionId: "moma", visitMin: 120 };
const ts: StopInput = { key: "times-square", name: "Times Square", lat: 40.758, lon: -73.9855, attractionId: "times-square", visitMin: 30 };

const request = (stops: StopInput[]): PlanRequest => ({
  stops, date: "2026-09-26", startMin: 540, endMin: 1260, mode: "transit", crowd: "avoid", origin: null, returnToOrigin: false, profile: DEFAULT_PROFILE, meals: { lunch: false, dinner: false },
});

/** A plan with stops back to back from 9am and a 15-minute subway ride between them. */
function planOf(r: PlanRequest): DayPlan {
  let t = r.startMin;
  const stops: PlannedStop[] = r.stops.map((s, i) => {
    const leg = i ? { mode: "subway" as const, minutes: 15, meters: 2000, estimated: false } : null;
    const arriveMin = t + (leg?.minutes ?? 0);
    t = arriveMin + s.visitMin;
    return { ...s, arriveMin, startMin: arriveMin, endMin: t, waitMin: 0, window: "always", issue: null, crowd: null, leg, meal: null, nearbyFood: null } as PlannedStop;
  });
  return { request: r, dow: 6, stops, returnLeg: null, summary: { finishMin: t, travelMin: 15 * (stops.length - 1), overMin: 0 }, baseline: null, insights: [], skipped: [], routing: { ok: true, source: "test" }, crowdSource: { name: "", weeks: [] }, exhaustive: true } as unknown as DayPlan;
}

function fakeRoam(chatReplies: ChatReply[]) {
  const roam: Roam = {
    assistant: vi.fn(async () => ({ stops: [met, moma], unresolved: [], date: null, startMin: null, endMin: null, mode: null, crowd: null, origin: null, profile: {}, meals: {}, choices: [], reply: "A classic museum day." }) satisfies AssistantResult),
    plan: vi.fn(async (r: PlanRequest) => planOf(r)),
    tripChat: vi.fn(async () => chatReplies.shift()!),
    weather: vi.fn(async () => null),
    budget: vi.fn(async () => null),
    shortLink: vi.fn(async () => "Ab3_x9Zq"),
  };
  return roam;
}

describe("the iMessage conversation", () => {
  it("plans a day from the first text, then edits it with numbers and YES", async () => {
    const withTs = planOf(request([met, moma, ts]));
    const cafe = { name: "787 Coffee", nextStops: [met, moma, ts, { key: "cafe", name: "787 Coffee", lat: 40.759, lon: -73.985, attractionId: null, visitMin: 30 }] };
    const roam = fakeRoam([
      {
        message: "Below is a preview to add Times Square. Here are 1 options for cafés.",
        choices: [],
        proposal: { title: "Add Times Square", plan: withTs, warnings: [] },
        discovery: { intent: { summary: "Cafés" }, area: { kind: "stop", label: "Near Times Square" }, results: [{ ...cafe, stop: cafe.nextStops[3], after: "Times Square", startMin: 915, endMin: 945, travelDelta: 4, reasons: ["Café"], conflicts: [], closed: false }], source: "openstreetmap", unrated: true, note: null } as never,
      },
      { message: "Here’s the proposed change.", choices: [], proposal: { title: "Fit 787 Coffee into your day", plan: planOf(request(cafe.nextStops)), warnings: [] } },
    ]);
    const bot = createBot(roam, "https://roam.test");
    const thread = newThread("any;-;+15551234567");

    const first = await bot.handle(thread, "The Met and MoMA on Saturday");
    expect(first.join("\n")).toContain("1. 9am  The Met");
    expect(first.join("\n")).toContain("Map: https://roam.test/p/Ab3_x9Zq");

    const both = await bot.handle(thread, "add times square and a cafe there");
    expect(both.join("\n")).toContain("1. 787 Coffee");
    expect(both.join("\n")).toContain("YES to apply just the change");

    // Applying Times Square keeps the café options: they were worked out on top of it.
    await bot.handle(thread, "yes");
    expect(thread.plan?.request.stops.map((s) => s.key)).toEqual(["met", "moma", "times-square"]);
    await bot.handle(thread, "1");
    expect(roam.tripChat).toHaveBeenLastCalledWith(expect.objectContaining({ action: { name: "preview_place", index: 1 }, offers: [cafe] }));
    await bot.handle(thread, "y");
    expect(thread.plan?.request.stops.map((s) => s.key)).toEqual(["met", "moma", "times-square", "cafe"]);
  });

  it("starts over on NEW TRIP and pauses on STOP", async () => {
    const roam = fakeRoam([]);
    const bot = createBot(roam, "https://roam.test");
    const thread = newThread("t");
    await bot.handle(thread, "museums please");
    await bot.handle(thread, "stop");
    expect(thread.muted).toBe(true);
    await bot.handle(thread, "new trip: Brooklyn on Sunday");
    expect(roam.assistant).toHaveBeenLastCalledWith("Brooklyn on Sunday", expect.objectContaining(DEFAULT_PROFILE), expect.objectContaining({ skipQuestions: false }));
  });
});

describe("asking before planning", () => {
  it("asks when and who, then plans the first request with the answer", async () => {
    const roam = fakeRoam([]);
    const assistant = vi.mocked(roam.assistant);
    const asked = await assistant.getMockImplementation()!("", DEFAULT_PROFILE);
    assistant.mockResolvedValueOnce({ ...asked, stops: [], reply: "Two quick questions so the day fits you.", questions: [
      { id: "when", question: "When are you going?", choices: [{ label: "Today", answer: "going today" }, { label: "Tomorrow", answer: "going tomorrow" }] },
      { id: "who", question: "Who's coming?", choices: [{ label: "Just me", answer: "just me" }] },
    ] });
    const bot = createBot(roam, "https://roam.test");
    const thread = newThread("t");

    const questions = await bot.handle(thread, "The Met and MoMA");
    expect(questions).toContain("When are you going? Today, Tomorrow?");
    expect(thread.plan).toBeNull();

    const planned = await bot.handle(thread, "tomorrow, me and my wife");
    expect(assistant).toHaveBeenLastCalledWith("The Met and MoMA. tomorrow, me and my wife.", DEFAULT_PROFILE, expect.objectContaining({ skipQuestions: true }));
    expect(planned.join("\n")).toContain("The Met");
    expect(thread.draft).toBeNull();
  });

  it("plans the request as it was on SKIP", async () => {
    const roam = fakeRoam([]);
    const bot = createBot(roam, "https://roam.test");
    const thread = { ...newThread("t"), draft: "Museums" };
    await bot.handle(thread, "skip");
    expect(roam.assistant).toHaveBeenLastCalledWith("Museums", DEFAULT_PROFILE, expect.objectContaining({ skipQuestions: true }));
  });
});

it("falls back to the full plan link when it can't be shortened", async () => {
  const roam = fakeRoam([]);
  vi.mocked(roam.shortLink).mockResolvedValue(null);
  const texts = await createBot(roam, "https://roam.test").handle(newThread("any;-;+15550000000"), "The Met and MoMA on Saturday");
  expect(texts.join("\n")).toContain("Map: https://roam.test/plan?plan=");
});

it("keeps what it sends the planner within its limits, however long the voice note", async () => {
  const roam = fakeRoam([{ message: "Sure.", choices: [] }]);
  const bot = createBot(roam, "https://roam.test");
  const thread = newThread("any;-;+15550000001");
  await bot.handle(thread, "The Met and MoMA on Saturday");
  thread.history.push({ role: "assistant", text: "x".repeat(5000) });
  await bot.handle(thread, `make it slower ${"please ".repeat(200)}`);
  const sent = vi.mocked(roam.tripChat).mock.calls.at(-1)![0];
  expect(sent.message.length).toBeLessThanOrEqual(600);
  expect(Math.max(...sent.history.map((h) => h.text.length))).toBeLessThanOrEqual(2000);
});

describe("short replies", () => {
  const ctx = { proposal: true, offers: 3, choices: 2 };
  it("reads numbers, letters and yes/no only when they mean something", () => {
    expect(parseCommand("2", ctx)).toEqual({ kind: "pick", index: 2 });
    expect(parseCommand("add option 3", ctx)).toEqual({ kind: "pick", index: 3 });
    expect(parseCommand("5", ctx)).toEqual({ kind: "text", text: "5" });
    expect(parseCommand("B", ctx)).toEqual({ kind: "choice", index: 1 });
    expect(parseCommand("Yes!", ctx)).toEqual({ kind: "yes" });
    expect(parseCommand("yes", { ...ctx, proposal: false })).toEqual({ kind: "text", text: "yes" });
    expect(parseCommand("show my day", ctx)).toEqual({ kind: "show" });
  });
  it("lists places briefly, saying what they share once", () => {
    const place = (name: string, travelDelta: number, over: number) => ({ name, after: "SIMÒ PIZZA", startMin: 860, travelDelta, reasons: ["4.5★ from 883 reviews", "$$"], conflicts: [`The day would run ${over} min past 9pm`], closed: false });
    const [texts] = [chatReply({
      message: "Here are 2 options for cafe cappuccino. Which feels right? Pick a place below, or tell me what you'd change about these options.",
      choices: [{ label: "Closer", message: "" }, { label: "Cheaper", message: "" }],
      discovery: { results: [place("Cafe Luna", 2, 27), place("Frisson Espresso", 12, 37)] } as never,
    })];
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe([
      "Here are 2 options for cafe cappuccino. Which one sounds good?",
      "",
      "All right after SIMÒ PIZZA:",
      "1. Cafe Luna · 2:20pm · +2 min · 4.5★ $$",
      "2. Frisson Espresso · 2:20pm · +12 min · 4.5★ $$",
      "⚠️ Any of these runs your day past 9pm.",
      "",
      "Reply with a number to add one, or A) Closer  B) Cheaper.",
    ].join("\n"));
  });
  it("shows only the problems a change causes, and how to answer", () => {
    const plan = planOf(request([met, moma]));
    const [words, change] = chatReply({
      message: "Adding it runs your day 27 minutes late. Keep the later finish?",
      choices: [],
      proposal: { title: "Fit Cafe Luna into your day", plan, warnings: ["The Met: Usually closed on Wednesdays", "The day finishes 27 minutes after your requested end time."], problems: ["The day finishes 27 minutes after your requested end time."] },
    });
    expect(words).toBe("Adding it runs your day 27 minutes late. Keep the later finish?");
    expect(change).toContain("⚠️ The day finishes 27 minutes");
    expect(change).not.toContain("The Met: Usually closed");
    expect(change).toContain("(1 issue your day already had)");
    expect(change).toContain("Reply YES to apply it, NO to keep your day, or tell me what to change.");
  });
  it("turns the model's markdown into plain text", () => {
    expect(plain("1. **Chinatown** (11:30am)\n* Brooklyn Bridge\n## Next")).toBe("1. Chinatown (11:30am)\n• Brooklyn Bridge\nNext");
  });
  it("accepts US numbers without +1, international numbers and Apple ID emails", () => {
    expect(normalizeHandle("(212) 555-0123")).toBe("+12125550123");
    expect(normalizeHandle("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizeHandle("Me@iCloud.com")).toBe("me@icloud.com");
    expect(normalizeHandle("12345")).toBeNull();
  });
});

describe("day-of nudges", () => {
  const plan = planOf(request([met, moma]));
  // MoMA: leave 11:30am (after the Met ends), arrive 11:45am.
  it("sends the morning rundown an hour before the first stop", () => {
    expect(dueNudges(plan, "2026-09-26", 8 * 60 + 5, new Set()).map((n) => n.key)).toEqual(["2026-09-26:morning"]);
    expect(dueNudges(plan, "2026-09-27", 8 * 60 + 5, new Set())).toEqual([]);
  });
  it("says when to leave ten minutes ahead, once", () => {
    const due = dueNudges(plan, "2026-09-26", 11 * 60 + 22, new Set());
    expect(due.map((n) => n.key)).toEqual(["2026-09-26:leave:moma"]);
    expect(due[0].text).toContain("Leave by 11:30am for MoMA");
    expect(dueNudges(plan, "2026-09-26", 11 * 60 + 22, new Set(["2026-09-26:leave:moma"]))).toEqual([]);
    // Past arrival, a late "leave now" is worse than none.
    expect(dueNudges(plan, "2026-09-26", 11 * 60 + 50, new Set())).toEqual([]);
  });
});
