import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../bridge/index";
import { consensus } from "../core/consensus";
import type { Trip } from "../core/types";
import { askRoom, centerOf, ideaSuggestions, roomContext } from "./suggest";

// Vitest runs without GEMINI_API_KEY, so these exercise the plain-words fallback against the real bundled places.
const trip: Trip = {
  id: "abcdefghij",
  title: "Saturday in NYC",
  createdAt: 0,
  hostId: "m1",
  settings: { date: "2026-10-03", startMin: 600, endMin: 1260, mode: "transit", crowd: "avoid", origin: null, returnToOrigin: false, profile: DEFAULT_PROFILE, meals: { lunch: false, dinner: false } },
  members: { m1: { name: "Khyati", avatar: { emoji: "🦊", color: "orange" }, joinedAt: 0, start: { area: "near Astor Pl", lat: 40.73, lon: -73.99 } } },
  candidates: [{ stop: { key: "met", name: "The Met", lat: 40.7794, lon: -73.9632, visitMin: 150, attractionId: "met" }, addedBy: "m1", addedAt: 0, votes: ["m1"] }],
  ideas: [{ id: "idea1", memberId: "m1", text: "dessert later?", votes: [], placeKey: null, at: 0 }, { id: "idea2", memberId: "m1", text: "levain bakery?", votes: [], placeKey: null, at: 0 }],
  deadline: null,
  confirmations: {},
  consensus: consensus({ members: ["m1"], confirmations: {}, draft: null, deadline: null, now: 0 }),
  draft: null,
  fairness: null,
  window: { from: 900, to: 1320, everyone: true, missing: [] },
  itinerary: { keys: [], manual: false, stale: false, editedBy: null, editedAt: null, tray: [] },
  lockedCode: null,
};

describe("room suggestions", () => {
  it("shares areas and votes with Gemini, never coordinates", () => {
    const ctx = roomContext(trip);
    expect(ctx).toContain("near Astor Pl");
    expect(ctx).toContain("The Met (1 vote)");
    expect(ctx).not.toMatch(/40\.7|-73\.9/);
  });

  it("looks around the group, not at anyone's exact spot, when there's no meeting spot", () => {
    expect(centerOf(trip)).toEqual({ lat: 40.73, lon: -73.99 });
  });

  it("finds real nearby places for a vague request, with crowd hints", async () => {
    const r = await askRoom(trip, "dessert");
    expect(r.usedAi).toBe(false);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0].stop.key).toMatch(/^osm-/);
    expect(r.items[0].crowdHint).toMatch(/^Usually /);
  });

  it("turns a note into choices, or a confirm when it names a place", async () => {
    const vague = await ideaSuggestions(trip, trip.ideas[0]);
    expect(vague.mode).toBe("choose");
    expect(vague.items.length).toBeGreaterThanOrEqual(3);
    const named = await ideaSuggestions(trip, trip.ideas[1]);
    expect(named.mode).toBe("confirm");
    expect(named.items[0].name).toMatch(/^Levain/);
  });
});
