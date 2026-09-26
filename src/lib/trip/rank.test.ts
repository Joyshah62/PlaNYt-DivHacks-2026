import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/plan/profile";
import { draftRequest, rankCandidates } from "./rank";
import type { Candidate, Trip, TripSettings } from "./types";

const settings: TripSettings = {
  date: "2026-10-03",
  startMin: 600,
  endMin: 1260,
  mode: "transit",
  crowd: "avoid",
  origin: null,
  returnToOrigin: false,
  profile: DEFAULT_PROFILE,
  meals: { lunch: false, dinner: false },
};

function cand(key: string, votes: string[], addedAt: number): Candidate {
  return { stop: { key, name: key, lat: 40.75, lon: -73.98, visitMin: 60, attractionId: null }, addedBy: "m1", addedAt, votes };
}

function trip(candidates: Candidate[]): Trip {
  return { id: "abcdefghij", title: "Saturday in NYC", createdAt: 0, organizerId: "m1", settings, members: { m1: "Khyati" }, candidates, lockedCode: null };
}

const keys = (list: Candidate[]) => list.map((c) => c.stop.key);

describe("rankCandidates", () => {
  it("orders by votes, then by who suggested first", () => {
    const { inDay } = rankCandidates(trip([cand("a", ["m1"], 3), cand("b", ["m1", "m2"], 2), cand("c", ["m2"], 1)]));
    expect(keys(inDay)).toEqual(["b", "c", "a"]);
  });

  it("keeps zero-vote places out of the day", () => {
    const { inDay, waiting } = rankCandidates(trip([cand("a", [], 1), cand("b", ["m1"], 2)]));
    expect(keys(inDay)).toEqual(["b"]);
    expect(keys(waiting)).toEqual(["a"]);
  });

  it("caps the day at 10 stops", () => {
    const many = Array.from({ length: 12 }, (_, i) => cand(`s${i}`, ["m1"], i));
    const { inDay, waiting } = rankCandidates(trip(many));
    expect(inDay).toHaveLength(10);
    expect(keys(waiting)).toEqual(["s10", "s11"]);
  });
});

describe("draftRequest", () => {
  it("is null when nothing has a vote", () => {
    expect(draftRequest(trip([cand("a", [], 1)]))).toBeNull();
  });

  it("combines the trip settings with the ranked stops", () => {
    const a = cand("a", ["m1"], 1);
    expect(draftRequest(trip([a]))).toEqual({ ...settings, stops: [a.stop] });
  });
});
