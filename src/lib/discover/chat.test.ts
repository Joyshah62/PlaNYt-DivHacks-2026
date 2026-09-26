import { describe, expect, it, vi } from "vitest";
import { ChatInput, executeChatTool, runTools } from "./chat";
import { PlanRequestSchema } from "@/lib/plan/schema";
import { buildPlan } from "@/lib/plan/build";
import { discover } from "./service";

vi.mock("./service", async (importOriginal) => {
  const original = await importOriginal<typeof import("./service")>();
  return { ...original, discover: vi.fn() };
});
vi.mock("@/lib/plan/build", () => ({ buildPlan: vi.fn(async (request) => ({ request, stops: [], skipped: [], summary: { overMin: 0 } })) }));
const request = PlanRequestSchema.parse({
  stops: [{ key: "a", name: "The Met", lat: 40.7794, lon: -73.9632, attractionId: "met", visitMin: 90 }],
  date: "2026-09-26", startMin: 540, endMin: 1080, mode: "transit", crowd: "avoid", origin: null, returnToOrigin: false,
});
const input = ChatInput.parse({ request, message: "Add the second one" });

describe("conversational trip tools", () => {
  it("returns clickable answers without changing the trip", async () => {
    const reply = await executeChatTool("reply_with_choices", { message: "Quick bite or sit-down?", choices: [{ label: "Quick bite", message: "A quick bite" }, { label: "Sit-down", message: "A sit-down meal" }] }, input);
    expect(reply.choices).toHaveLength(2);
    expect(reply.proposal).toBeUndefined();
  });
  it("rejects a model selecting an option that was never offered", async () => {
    await expect(executeChatTool("preview_place", { index: 2 }, input)).rejects.toThrow("no longer available");
  });
  it("previews the exact offered stop list and preserves its times", async () => {
    const nextStops = [...request.stops, { key: "pizza", name: "Pizza", lat: 40.77, lon: -73.96, attractionId: null, visitMin: 30, fixedStartMin: 720, mealFor: "lunch" as const }];
    const reply = await executeChatTool("preview_place", { index: 1 }, { ...input, offers: [{ name: "Pizza", nextStops }] });
    expect(reply.proposal?.plan.request.stops).toEqual(nextStops);
    expect(reply.proposal?.plan.request.keepOrder).toBe(true);
    expect(reply.proposal?.plan.request.meals.lunch).toBe(true);
    expect(request.stops).toHaveLength(1);
  });
  it("does not let a tool remove the only stop", async () => {
    await expect(executeChatTool("remove_stop", { key: "a" }, input)).rejects.toThrow("at least one");
  });
  it("passes placement and time to search instead of inventing results", async () => {
    vi.mocked(discover).mockResolvedValueOnce(Response.json({ intent: { summary: "Pizza" }, results: [], area: { kind: "trip", label: "Along your trip" }, source: "openstreetmap", note: null }));
    await executeChatTool("search_places", { query: "pizza after the Met", refine: false, afterStopKey: "a", preferredStartMin: 720 }, input);
    expect(discover).toHaveBeenLastCalledWith(expect.objectContaining({ placement: { after: "a", preferredStartMin: 720 }, placementPinned: true }));
  });
  it("surfaces scheduling conflicts in the change preview", async () => {
    vi.mocked(buildPlan).mockResolvedValueOnce({ request, stops: [{ name: "The Met", issue: "late" }], skipped: [], summary: { overMin: 20 } } as never);
    const reply = await executeChatTool("update_preferences", { mode: "walk" }, input);
    expect(reply.proposal?.warnings).toHaveLength(2);
  });
});

describe("several requests in one message", () => {
  const emptySearch = () => Response.json({ intent: { summary: "Cafés" }, results: [{ name: "Café" }], area: { kind: "trip", label: "Along your trip" }, source: "openstreetmap", note: null });

  it("adds a named place and searches around it in the same turn", async () => {
    vi.mocked(discover).mockResolvedValueOnce(emptySearch());
    const reply = await runTools([
      { name: "add_place", args: { name: "Times Square", afterStopKey: null, visitMin: null } },
      { name: "search_places", args: { query: "café near Times Square", refine: false, afterStopKey: "new:1", preferredStartMin: null } },
    ], input);
    expect(reply.proposal?.plan.request.stops.map((s) => s.key)).toEqual(["a", "times-square"]);
    expect(reply.discovery).toBeDefined();
    // The search runs on the trip with Times Square in it, placed after it.
    expect(discover).toHaveBeenLastCalledWith(expect.objectContaining({
      placement: { after: "times-square", preferredStartMin: null },
      placementPinned: true,
      request: expect.objectContaining({ stops: expect.arrayContaining([expect.objectContaining({ key: "times-square" })]) }),
    }));
  });
  it("stacks several changes into one preview", async () => {
    const two = { ...input, request: { ...request, stops: [...request.stops, { key: "b", name: "MoMA", lat: 40.7614, lon: -73.9776, attractionId: "moma", visitMin: 90 }] } };
    const reply = await runTools([
      { name: "remove_stop", args: { key: "b" } },
      { name: "add_place", args: { name: "Times Square", afterStopKey: "a", visitMin: 45 } },
    ], two);
    expect(reply.proposal?.plan.request.stops.map((s) => [s.key, s.visitMin])).toEqual([["a", 90], ["times-square", 45]]);
    expect(reply.proposal?.title).toBe("Remove MoMA · Add Times Square");
  });
  it("offers extra searches as follow-ups instead of dropping them", async () => {
    vi.mocked(discover).mockResolvedValueOnce(emptySearch());
    const reply = await runTools([
      { name: "search_places", args: { query: "café", refine: false, afterStopKey: null, preferredStartMin: null } },
      { name: "search_places", args: { query: "pizza", refine: false, afterStopKey: null, preferredStartMin: null } },
    ], input);
    expect(reply.choices).toContainEqual({ label: "Next: pizza", message: "Find pizza" });
  });
  it("won't add a place that's already in the trip", async () => {
    await expect(runTools([{ name: "add_place", args: { name: "The Met", afterStopKey: null, visitMin: null } }], { ...input, request: { ...request, stops: [{ ...request.stops[0], key: "met" }] } })).rejects.toThrow("already in your trip");
  });
});
