import { describe, expect, it, vi } from "vitest";
import { ChatInput, conversation, executeChatTool, meantTime, namedPlaceIn, runTools, settle } from "./chat";
import { PlanRequestSchema } from "@/lib/plan/schema";
import { buildPlan } from "@/lib/plan/build";
import { discover } from "./service";
import { ATTRACTIONS } from "@/lib/plan/attractions";
import { visitFor } from "@/lib/plan/profile";
import * as crowds from "@/lib/plan/crowd";
import { exactPlace, lookupCandidates } from "./placeLookup";
import { evaluate } from "./evaluate";
import { resolveDestination } from "@/lib/osm/nominatim";
import type { Candidate, Result } from "./types";

vi.mock("./placeLookup", async (importOriginal) => ({ ...await importOriginal<typeof import("./placeLookup")>(), lookupCandidates: vi.fn(), exactPlace: vi.fn() }));
vi.mock("./evaluate", async (importOriginal) => ({ ...await importOriginal<typeof import("./evaluate")>(), evaluate: vi.fn() }));
vi.mock("@/lib/osm/nominatim", () => ({ resolveDestination: vi.fn() }));

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

describe("identifying a described business before adding it", () => {
  const place: Candidate = { id: "g-bungalow", name: "Bungalow", lat: 40.7245, lon: -73.9896, category: "restaurant", kind: "Indian restaurant", cuisine: null, rating: 4.5, reviews: 100, price: 3, hours: null, address: "24 1st Ave, New York", website: "https://www.bungalowny.com", source: "google", meters: 600 };
  const described = { ...input, message: "i want to go to vikas khanna's restaurant after museum" };
  const result = { ...place, stop: { key: "find-g-bungalow", name: place.name, lat: place.lat, lon: place.lon, visitMin: 60, attractionId: null }, nextStops: request.stops } as Result;

  it("intercepts a hallucinated name and searches the original description with placement intact", async () => {
    vi.mocked(lookupCandidates).mockResolvedValueOnce([place]);
    vi.mocked(evaluate).mockResolvedValueOnce([result]);
    const reply = await executeChatTool("add_place", { name: "Bandra Cafe New York", afterStopKey: "a", visitMin: null }, described);
    expect(lookupCandidates).toHaveBeenLastCalledWith(described.message, "restaurant");
    expect(evaluate).toHaveBeenLastCalledWith(request, [place], expect.objectContaining({ after: "a", searchText: described.message }));
    expect(reply.proposal).toBeUndefined();
    expect(reply.message).toContain("Bungalow at 24 1st Ave");
    expect(reply.message).toContain("after The Met");
    expect(reply.message).not.toContain("Bandra");
    expect(resolveDestination).not.toHaveBeenCalled();
  });

  it("does not substitute a guessed name even inside the lookup tool", async () => {
    vi.mocked(lookupCandidates).mockResolvedValueOnce([place]);
    vi.mocked(evaluate).mockResolvedValueOnce([result]);
    await executeChatTool("lookup_place", { query: "Bandra Cafe", category: "restaurant", afterStopKey: "a" }, described);
    expect(lookupCandidates).toHaveBeenLastCalledWith(described.message, "restaurant");
  });

  it("does not substitute an unrelated catalog restaurant for a chef description", async () => {
    vi.mocked(lookupCandidates).mockResolvedValueOnce([place]);
    vi.mocked(evaluate).mockResolvedValueOnce([result]);
    const reply = await executeChatTool("add_place", { name: "Katz's Delicatessen", afterStopKey: "a", visitMin: null }, described);
    expect(lookupCandidates).toHaveBeenLastCalledWith(described.message, "restaurant");
    expect(reply.proposal).toBeUndefined();
  });

  it("asks for a name or address when the description cannot be resolved", async () => {
    vi.mocked(lookupCandidates).mockResolvedValueOnce(null);
    const reply = await executeChatTool("lookup_place", { query: "vikas khanna's restaurant", category: "restaurant", afterStopKey: "a" }, described);
    expect(reply.proposal).toBeUndefined();
    expect(reply.discovery).toBeUndefined();
    expect(reply.message).toContain("name, website, or street address");
  });

  it("uses canonical provider data for a business named by the user", async () => {
    vi.mocked(exactPlace).mockResolvedValueOnce(place);
    const reply = await executeChatTool("add_place", { name: "Bungalow New York", afterStopKey: "a", visitMin: 90 }, { ...input, message: "Add Bungalow after the museum" });
    expect(reply.proposal?.plan.request.stops[1]).toMatchObject({ name: "Bungalow", lat: place.lat, lon: place.lon, hours: place.hours, visitMin: 90 });
  });

  it("never turns a failed business lookup into an arbitrary address match", async () => {
    vi.mocked(exactPlace).mockResolvedValueOnce(null);
    await expect(executeChatTool("add_place", { name: "Bandra Cafe", afterStopKey: "a", visitMin: null }, { ...input, message: "Add Bandra Cafe" })).rejects.toThrow("couldn't verify a unique place");
    expect(resolveDestination).not.toHaveBeenCalled();
  });
});

/** Exercise real opening hours, crowds and scheduling with deterministic travel. */
async function withScheduler(run: () => Promise<void>) {
  const actual = await vi.importActual<typeof import("@/lib/plan/build")>("@/lib/plan/build");
  await vi.mocked(buildPlan).withImplementation((request) => actual.buildPlan(request, async (points) => ({
    routed: true,
    legs: points.map((_, i) => points.map((_, j) => ({ mode: "walk" as const, minutes: i === j ? 0 : 10, meters: i === j ? 0 : 700, estimated: true }))),
  })), run);
}

describe("conversational trip tools", () => {
  it.each([false, true])("keeps a requested 7pm dinner when adding a place (already present: %s)", (present) => withScheduler(async () => {
    const restaurant = { key: "tavern", name: "Tavern On the Green", lat: 40.767, lon: -73.977, attractionId: null, visitMin: 60 };
    const day = { ...request, endMin: 1260, meals: { lunch: false, dinner: false }, stops: present ? [...request.stops, restaurant] : request.stops };
    const dinner = { ...input, request: day, message: "okay add tavern cafe to my dinner schedule around 7pm", offers: [{ name: restaurant.name, nextStops: [...request.stops, restaurant] }] };
    const result = await executeChatTool("add_place", { name: restaurant.name, afterStopKey: null, visitMin: null }, dinner);
    const { reply } = await settle(result, dinner);
    expect(reply.resolution).toBe("apply");
    expect(reply.proposal!.plan.stops.find((s) => s.key === "tavern")?.startMin).toBe(1140);
    expect(reply.proposal!.plan.request.stops.find((s) => s.key === "tavern")).toMatchObject({ fixedStartMin: 1140, mealFor: "dinner" });
    expect(reply.proposal!.plan.stops.some((s) => s.key === "meal-dinner")).toBe(false);
  }));

  it("does not auto-apply a dinner time beyond the day's end", () => withScheduler(async () => {
    const dinner = { ...input, message: "Add Times Square at 7pm", request: { ...request, endMin: 1080 } };
    const result = await executeChatTool("add_place", { name: "Times Square", afterStopKey: null, visitMin: 60, startMin: 1140 }, dinner);
    const { reply, problems } = await settle(result, dinner);
    expect(reply.resolution).not.toBe("apply");
    expect(problems.length).toBeGreaterThan(0);
    expect(reply.proposal!.plan.request.stops.find((s) => s.key === "times-square")?.fixedStartMin).toBe(1140);
  }));

  it.each(["lunch", "dinner"] as const)("removes a generated %s break while keeping the only place and other meal", (meal) => withScheduler(async () => {
    const day = { ...request, endMin: 1260, meals: { lunch: true, dinner: true } };
    const before = await buildPlan(day);
    expect(before.stops.some((s) => s.key === `meal-${meal}`)).toBe(true);
    const removal = { ...input, request: day, message: `Remove the ${meal} break` };
    const result = await executeChatTool("remove_stop", { key: `meal-${meal}` }, removal);
    const { reply } = await settle(result, removal);
    expect(reply.resolution).toBe("apply");
    const next = reply.proposal!.plan;
    expect(next.request.stops).toEqual(day.stops);
    expect(next.request.meals).toEqual({ lunch: true, dinner: true, [meal]: false });
    expect(next.stops.some((s) => s.key === `meal-${meal}`)).toBe(false);
    const rebuilt = await buildPlan(next.request);
    expect(rebuilt.stops.some((s) => s.key === `meal-${meal}`)).toBe(false);
    const repeated = await executeChatTool("remove_stop", { key: `meal-${meal}` }, { ...removal, request: next.request });
    expect(repeated.proposal).toBeUndefined();
  }));

  it("still rejects an unknown place key", async () => {
    await expect(executeChatTool("remove_stop", { key: "missing-place" }, input)).rejects.toThrow("no longer in your trip");
  });

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

describe("times the traveler said", () => {
  // An evening day: the ferry at 7pm, then dessert and Chinatown, over by 9pm.
  const evening = ChatInput.parse({
    request: { ...request, startMin: 1140, endMin: 1260, keepOrder: true, stops: [{ ...request.stops[0], key: "ferry", name: "Staten Island Ferry", attractionId: null, visitMin: 60 }] },
    message: "ca you move the time a bit early like 6:30 if it is clashing in opening hours",
  });

  it("reads a bare hour on an evening day as pm, unless they said otherwise", () => {
    const day = { startMin: 1140 };
    expect(meantTime(390, "move it to 6:30", day)).toBe(1110);
    expect(meantTime(390, "start at 6:30am", day)).toBe(390);
    expect(meantTime(390, "start at 6:30 in the morning", day)).toBe(390);
    expect(meantTime(420, "start at 7", { startMin: 540 })).toBe(420);
    expect(meantTime(360, "finish by 6", { startMin: 540 }, true)).toBe(1080);
    expect(meantTime(420, "start at 7pm", { startMin: 540 })).toBe(1140);
  });

  it("changes only the start when the model repeats every setting with morning times", async () => {
    const reply = await executeChatTool("update_preferences", {
      date: evening.request.date, origin: null, group: "solo", interests: [], optimizeOrder: false, pace: "balanced",
      mode: "transit", crowd: "avoid", startMin: 390, endMin: 540, walkMax: null, lunch: false, dinner: false,
    }, evening);
    expect(reply.proposal?.plan.request).toMatchObject({ startMin: 1110, endMin: 1260 });
    expect(reply.proposal?.title).toBe("Update your day: start at 6:30pm");
  });

  it("moves a stop to the evening time they meant", async () => {
    const early = { ...evening, request: { ...evening.request, startMin: 1110 } };
    const reply = await executeChatTool("reschedule_stop", { key: "ferry", avoidCrowds: false, startMin: 390, afterStopKey: null }, early);
    expect(reply.proposal?.title).toBe("Move Staten Island Ferry to 6:30pm");
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

describe("searches that name a place", () => {
  it("adds the named place, at a quiet time when asked", () => withScheduler(async () => {
    const reply = await runTools([{ name: "search_places", args: { query: "Central Park avoiding peak crowds", refine: false, afterStopKey: null, preferredStartMin: 1020 } }], { ...input, request: { ...request, keepOrder: true } });
    expect(reply.proposal?.title).toBe("Add Central Park at a quiet time");
    // Every slot is tried with the rest of the day in its order; the quietest wins.
    expect(reply.proposal?.plan.request).toMatchObject({ keepOrder: true });
    expect(reply.proposal?.plan.request.stops.map((s) => s.key).sort()).toEqual(["a", "central-park"]);
  }));
  it("keeps searching around a place, or for a kind of place", () => {
    expect(namedPlaceIn("a walk in Central Park")).toEqual({ name: "Central Park", avoidCrowds: false });
    expect(namedPlaceIn("café near Central Park")).toBeNull();
    expect(namedPlaceIn("best pizza Brooklyn Bridge")).toBeNull();
    expect(namedPlaceIn("rooftop bar")).toBeNull();
  });
});

describe("moving a stop that's already in the day", () => {
  const three = { ...input, request: { ...request, stops: [...request.stops, { key: "central-park", name: "Central Park", lat: 40.774, lon: -73.971, attractionId: "central-park", visitMin: 120, fixedStartMin: 900 }, { key: "b", name: "MoMA", lat: 40.7614, lon: -73.9776, attractionId: "moma", visitMin: 90 }] } };
  it("moves it to a quieter time instead of refusing", () => withScheduler(async () => {
    const reply = await runTools([{ name: "add_place", args: { name: "Central Park", afterStopKey: null, visitMin: null, avoidCrowds: true } }], three);
    expect(reply.proposal?.title).toBe("Move Central Park to a quieter time");
    const stops = reply.proposal!.plan.request.stops;
    expect(stops.filter((s) => s.key === "central-park")).toHaveLength(1);
    const moved = reply.proposal!.plan.stops.find((s) => s.key === "central-park")!;
    expect(moved.startMin).not.toBe(900);
    expect(moved.crowd?.band).not.toBe("peak");
  }));
  it("moves it after a named stop", async () => {
    const reply = await runTools([{ name: "add_place", args: { name: "Central Park", afterStopKey: "b", visitMin: null, avoidCrowds: false } }], three);
    expect(reply.proposal?.plan.request.stops.map((s) => s.key)).toEqual(["a", "b", "central-park"]);
  });
  it("says what it needs when there's nowhere to move it", async () => {
    await expect(runTools([{ name: "add_place", args: { name: "Central Park", afterStopKey: null, visitMin: null, avoidCrowds: false } }], three)).rejects.toThrow("Say which stop it should follow");
  });
});

describe("rescheduling instead of swapping a place with itself", () => {
  const bridge = { key: "bridge-view", name: "DUMBO Manhattan Bridge View", lat: 40.7033, lon: -73.9894, attractionId: null, visitMin: 60, fixedStartMin: 990 };
  const day = ChatInput.parse({ request: { ...request, endMin: 1260, keepOrder: true, stops: [
    { key: "park", name: "Brooklyn Bridge Park", lat: 40.7002, lon: -73.9965, attractionId: "brooklyn-bridge-park", visitMin: 60 },
    bridge,
    { key: "williamsburg", name: "Williamsburg", lat: 40.7178, lon: -73.9596, attractionId: null, visitMin: 60 },
  ] }, message: "I don't want to visit bridge view at peak time, change the time" });

  it("treats a self-replacement as a move and preserves every stop", () => withScheduler(async () => {
    const before = await buildPlan(day.request);
    const reply = await executeChatTool("add_place", { name: bridge.name, replaceKey: bridge.key, avoidCrowds: true, afterStopKey: null, visitMin: null }, day);
    expect(reply.proposal?.title).toBe(`Move ${bridge.name} to a quieter time`);
    const plan = reply.proposal!.plan;
    expect(plan.request.stops.map((s) => s.key).sort()).toEqual(day.request.stops.map((s) => s.key).sort());
    expect(plan.request.stops.find((s) => s.key === bridge.key)).toMatchObject({ key: bridge.key, name: bridge.name, lat: bridge.lat, lon: bridge.lon, visitMin: 60 });
    const moved = plan.stops.find((s) => s.key === bridge.key)!;
    expect(moved.crowd!.level).toBeLessThan(before.stops.find((s) => s.key === bridge.key)!.crowd!.level);
    expect(moved.crowd!.band).not.toBe("peak");
    expect(reply.message).not.toContain("swap");
  }));

  it("never lets a self-swap without placement remove an unrelated stop", async () => {
    await expect(executeChatTool("add_place", { name: bridge.name, replaceKey: bridge.key, afterStopKey: null, visitMin: null }, day)).rejects.toThrow("Say which stop");
    expect(day.request.stops).toHaveLength(3);
  });

  it("can wait for an off-peak evening slot rather than only reorder stops", async () => {
    const levels = Array.from({ length: 24 }, (_, h) => h >= 18 ? 0.2 : 0.95);
    const profile = vi.spyOn(crowds, "crowdProfile").mockReturnValue({ levels, riders: [], station: "Test station", stationMeters: 100 });
    try {
      await withScheduler(async () => {
        const reply = await executeChatTool("reschedule_stop", { key: bridge.key, avoidCrowds: true, startMin: null, afterStopKey: null }, { ...day, request: { ...day.request, stops: [{ ...bridge, fixedStartMin: null }] } });
        expect(reply.proposal?.plan.stops[0].startMin).toBe(1080);
        expect(reply.proposal?.plan.stops[0].crowd?.band).toBe("quiet");
      });
    } finally { profile.mockRestore(); }
  });

  it("asks about different hours when every feasible visit is still peak", async () => {
    const levels = Array.from({ length: 24 }, (_, h) => h < 9 ? 0.2 : 0.95);
    const profile = vi.spyOn(crowds, "crowdProfile").mockReturnValue({ levels, riders: [], station: "Test station", stationMeters: 100 });
    try {
      await withScheduler(async () => {
        const reply = await executeChatTool("reschedule_stop", { key: bridge.key, avoidCrowds: true, startMin: null, afterStopKey: null }, day);
        expect(reply.proposal).toBeUndefined();
        expect(reply.message).toContain("couldn't find a feasible off-peak time");
        expect(reply.message).toContain("7am");
        expect(reply.choices).toHaveLength(2);
      });
    } finally { profile.mockRestore(); }
  });

  it("does not claim a quieter time when crowd information is unavailable", async () => {
    const profile = vi.spyOn(crowds, "crowdProfile").mockReturnValue(null);
    try {
      await withScheduler(async () => {
        const reply = await executeChatTool("reschedule_stop", { key: bridge.key, avoidCrowds: true, startMin: null, afterStopKey: null }, day);
        expect(reply.proposal).toBeUndefined();
        expect(reply.message).toContain("don't have enough crowd information");
      });
    } finally { profile.mockRestore(); }
  });

  it("uses the newly chosen day hours before scheduling an explicit earlier visit", () => withScheduler(async () => {
    const args = { key: bridge.key, avoidCrowds: false, startMin: 420, afterStopKey: null };
    await expect(executeChatTool("reschedule_stop", args, day)).rejects.toThrow("outside your day's hours");
    const reply = await runTools([
      { name: "reschedule_stop", args },
      { name: "update_preferences", args: { startMin: 420 } },
    ], day);
    expect(reply.proposal?.plan.request.startMin).toBe(420);
    expect(reply.proposal?.plan.stops.find((s) => s.key === bridge.key)?.startMin).toBe(420);
    expect(reply.proposal?.warnings).toEqual([]);
  }));

  it("allows a quieter move without hiding an unchanged conflict elsewhere", () => withScheduler(async () => {
    const conflicting = { ...day, request: { ...day.request, stops: [
      day.request.stops[0],
      { key: "lunch", name: "Lunch spot", lat: 40.7027, lon: -73.9934, attractionId: null, visitMin: 120, fixedStartMin: 690 },
      { ...day.request.stops[2], fixedStartMin: 810 },
      bridge,
    ] } };
    const before = await buildPlan(conflicting.request);
    expect(before.stops.find((s) => s.key === "williamsburg")?.issue).toBe("late");
    const reply = await runTools([
      { name: "update_preferences", args: { startMin: 420 } },
      { name: "reschedule_stop", args: { key: bridge.key, avoidCrowds: true, startMin: 420, afterStopKey: null } },
    ], conflicting);
    expect(reply.proposal?.plan.stops.find((s) => s.key === bridge.key)?.startMin).toBe(420);
    expect(reply.proposal?.warnings).toContain("Williamsburg: arrives after its set time");
    expect(reply.proposal?.plan.request.stops).toHaveLength(4);
  }));
});

describe("the conversation", () => {
  it("waits for clarification even if the model also queued a change", async () => {
    const reply = await runTools([
      { name: "update_preferences", args: { mode: "walk" } },
      { name: "reply_with_choices", args: { message: "Less walking or an earlier finish?", choices: [{ label: "Less walking", message: "Use transit" }, { label: "Earlier finish", message: "Finish by 4pm" }] } },
    ], input);
    expect(reply.proposal).toBeUndefined();
    expect(reply.message).toContain("Less walking");
  });
  it("refines a pending preview without losing its earlier edits", async () => {
    const first = await executeChatTool("add_place", { name: "Times Square", afterStopKey: "a", visitMin: 45 }, input);
    const reply = await executeChatTool("update_preferences", { endMin: 1020 }, {
      ...input, message: "Actually finish by 5pm", pending: { request: first.proposal!.plan.request, title: first.proposal!.title },
    });
    expect(reply.proposal?.plan.request.stops.map((s) => s.key)).toEqual(["a", "times-square"]);
    expect(reply.proposal?.plan.request.endMin).toBe(1020);
    expect(request.endMin).toBe(1080);
    expect(request.stops).toHaveLength(1);
  });
  it("accepts only an existing preview and recalculates it", async () => {
    const reply = await executeChatTool("resolve_proposal", { decision: "apply" }, { ...input, pending: { request: { ...request, mode: "walk" }, title: "Walk between stops" } });
    expect(reply.resolution).toBe("apply");
    expect(reply.proposal?.plan.request.mode).toBe("walk");
    await expect(executeChatTool("resolve_proposal", { decision: "apply" }, input)).rejects.toThrow("no pending change");
  });
  it("keeps a preview with conflicts for review instead of applying it through chat", async () => {
    vi.mocked(buildPlan).mockResolvedValueOnce({ request, stops: [], skipped: [], summary: { overMin: 30 } } as never);
    const reply = await executeChatTool("resolve_proposal", { decision: "apply" }, { ...input, pending: { request, title: "A longer day" } });
    expect(reply.resolution).toBeUndefined();
    expect(reply.proposal?.warnings).toHaveLength(1);
  });
  it("discards a preview without changing the saved trip", async () => {
    const reply = await executeChatTool("resolve_proposal", { decision: "discard" }, { ...input, pending: { request, title: "Draft" } });
    expect(reply.resolution).toBe("discard");
    expect(reply.proposal).toBeUndefined();
  });
  it("never applies new edits in the same batch as an acceptance", async () => {
    await expect(runTools([
      { name: "update_preferences", args: { mode: "walk" } },
      { name: "resolve_proposal", args: { decision: "apply" } },
    ], { ...input, pending: { request, title: "Draft" } })).rejects.toThrow("review the revised change");
  });
  it("sends history as alternating turns that open with the traveler", () => {
    const turns = conversation([
      { role: "assistant", text: "Updated your trip." },
      { role: "user", text: "add food" },
      { role: "assistant", text: "A meal or a snack?" },
      { role: "assistant", text: "Or a café?" },
    ], "A snack");
    expect(turns).toEqual([
      { role: "user", content: "add food" },
      { role: "assistant", content: "A meal or a snack?\n\nOr a café?" },
      { role: "user", content: "A snack" },
    ]);
  });
  it("drops an answer offered twice", async () => {
    const reply = await runTools([{ name: "reply_with_choices", args: { message: "How?", choices: [{ label: "Relax", message: "Make it more relaxed" }, { label: "Relax", message: "make it more relaxed" }, { label: "Drop", message: "Drop MoMA" }] } }], input);
    expect(reply.choices.map((c) => c.message)).toEqual(["Make it more relaxed", "Drop MoMA"]);
  });
});

describe("choices that change the day", () => {
  it("applies chosen times, walking limit and meals while preserving other preferences", async () => {
    const reply = await executeChatTool("update_preferences", { startMin: 600, endMin: 1020, walkMax: 10, dinner: true }, input);
    expect(reply.proposal?.plan.request).toMatchObject({ startMin: 600, endMin: 1020, mode: "transit", crowd: "avoid", profile: { walkMax: 10, pace: "balanced" }, meals: { lunch: false, dinner: true } });
  });
  it("rejects impossible day boundaries with an actionable message", async () => {
    await expect(executeChatTool("update_preferences", { endMin: 500 }, { ...input, message: "finish at 8:20am" })).rejects.toThrow("end after it starts");
  });
  it("adjusts ordinary visit durations for pace but keeps custom and booked visits", async () => {
    const met = ATTRACTIONS.find((a) => a.id === "met")!;
    const stop = { ...request.stops[0], visitMin: visitFor(met, "balanced") };
    const reply = await executeChatTool("update_preferences", { pace: "relaxed" }, {
      ...input, request: { ...request, stops: [stop, { ...stop, key: "custom", visitMin: 35 }, { ...stop, key: "booked", fixedStartMin: 900 }] },
    });
    expect(reply.proposal?.plan.request.stops.map((s) => s.visitMin)).toEqual([visitFor(met, "relaxed"), 35, stop.visitMin]);
  });
});

describe("near me", () => {
  const cafes = () => Response.json({ intent: { summary: "Cafés" }, results: [], area: { kind: "here", label: "Near you" }, source: "google", note: null });
  it("searches around the traveler's position", async () => {
    vi.mocked(discover).mockResolvedValueOnce(cafes());
    await runTools([{ name: "search_places", args: { query: "café", refine: false, afterStopKey: null, preferredStartMin: null, nearMe: true } }], { ...input, here: { lat: 40.7536, lon: -73.9832 } });
    expect(discover).toHaveBeenLastCalledWith(expect.objectContaining({ area: { kind: "here", lat: 40.7536, lon: -73.9832 }, areaPinned: true }));
  });
  it("asks for a place when it doesn't know where they are", async () => {
    await expect(runTools([{ name: "search_places", args: { query: "café", refine: false, afterStopKey: null, preferredStartMin: null, nearMe: true } }], input)).rejects.toThrow("Tell me a street or neighborhood");
  });
});

describe("swapping one place for another", () => {
  const reggio = { key: "reggio", name: "Cafe Reggio", lat: 40.7303, lon: -74.0004, attractionId: null, visitMin: 45 };
  const sipsteria = { key: "place-sipsteria", name: "Sipsteria Morningside", lat: 40.8058, lon: -73.9654, attractionId: null, visitMin: 45 };
  const one = { ...input, request: { ...request, stops: [reggio] }, offers: [{ name: "Sipsteria Morningside", nextStops: [reggio, sipsteria] }] };

  it("swaps the only stop instead of refusing to empty the day", async () => {
    const reply = await runTools([{ name: "add_place", args: { name: "sipsteria", afterStopKey: null, visitMin: null, replaceKey: "reggio" } }], one);
    expect(reply.proposal?.title).toBe("Swap Cafe Reggio for Sipsteria Morningside");
    // The card's place, not a geocoder guess at the name.
    expect(reply.proposal?.plan.request.stops).toEqual([expect.objectContaining({ key: "place-sipsteria", lat: 40.8058 })]);
  });
  it("puts the new place in the old one's spot", async () => {
    const three = { ...one, request: { ...request, stops: [request.stops[0], reggio, { ...request.stops[0], key: "z", name: "Zoo" }] } };
    const reply = await runTools([{ name: "preview_place", args: { index: 1, replaceKey: "reggio" } }], three);
    expect(reply.proposal?.plan.request.stops.map((s) => s.key)).toEqual(["a", "place-sipsteria", "z"]);
  });
  it("adds before it removes, and skips removing what was swapped out", async () => {
    const reply = await runTools([
      { name: "remove_stop", args: { key: "reggio" } },
      { name: "add_place", args: { name: "Sipsteria Morningside", afterStopKey: null, visitMin: null, replaceKey: "reggio" } },
    ], one);
    expect(reply.proposal?.plan.request.stops.map((s) => s.key)).toEqual(["place-sipsteria"]);
  });
});

describe("everything the traveler could change", () => {
  const two = { ...input, request: { ...request, stops: [...request.stops, { key: "b", name: "MoMA", lat: 40.7614, lon: -73.9776, attractionId: "moma", visitMin: 120, fixedStartMin: 900 }] } };

  it("moves the day, sets where it starts and who's going, and lets the planner reorder", async () => {
    const reply = await executeChatTool("update_preferences", { date: "2099-10-03", origin: "Times Square", returnToOrigin: true, group: "family", interests: ["art"], optimizeOrder: true }, { ...input, message: "Plan for my family with kids, on October 3, starting at Times Square; we like art. Optimize the order." });
    expect(reply.proposal?.plan.request).toMatchObject({
      date: "2099-10-03",
      origin: { label: "Times Square" },
      returnToOrigin: true,
      keepOrder: false,
      profile: { group: "family", interests: ["art"], pace: "balanced" },
    });
  });
  it("starts from where they are, and refuses a day that's already gone", async () => {
    const reply = await executeChatTool("update_preferences", { origin: "my location" }, { ...input, here: { lat: 40.8075, lon: -73.9626 } });
    expect(reply.proposal?.plan.request.origin).toEqual({ label: "Your location", lat: 40.8075, lon: -73.9626 });
    await expect(executeChatTool("update_preferences", { date: "2020-01-01" }, input)).rejects.toThrow("already passed");
  });
  it("changes how long a visit lasts and clears a booking time", async () => {
    const reply = await executeChatTool("edit_stop", { key: "b", visitMin: 180, clearStartTime: true }, two);
    expect(reply.proposal?.title).toBe("Spend 3h at MoMA and free up MoMA's set time");
    expect(reply.proposal?.plan.request.stops[1]).toMatchObject({ visitMin: 180, fixedStartMin: null });
  });
  it("puts named stops first and keeps the rest in order", async () => {
    const reply = await executeChatTool("reorder_stops", { keys: ["b"] }, two);
    expect(reply.proposal?.plan.request).toMatchObject({ keepOrder: true });
    expect(reply.proposal?.plan.request.stops.map((s) => s.key)).toEqual(["b", "a"]);
  });
});

describe("deciding whether a change goes in", () => {
  it("applies a change that doesn't make the day worse", async () => {
    const reply = await executeChatTool("update_preferences", { pace: "relaxed" }, input);
    const { reply: settled, problems } = await settle(reply, input);
    expect(problems).toEqual([]);
    expect(settled).toMatchObject({ resolution: "apply", message: "Done: update your day: relaxed pace." });
  });
  it("holds a change that adds a problem, and says what it is", async () => {
    const reply = await executeChatTool("update_preferences", { pace: "relaxed" }, input);
    const late = { ...reply, proposal: { ...reply.proposal!, warnings: ["The day finishes 40 minutes after your requested end time."] } };
    const { reply: settled, problems } = await settle(late, input);
    expect(settled.resolution).toBeUndefined();
    expect(problems).toEqual(["The day finishes 40 minutes after your requested end time."]);
  });
});
