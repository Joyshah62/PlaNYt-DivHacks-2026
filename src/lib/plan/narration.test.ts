import { describe, expect, it } from "vitest";
import { narrateItinerary } from "./narration";

describe("narrateItinerary", () => {
  it("summarizes today's stops, travel and the crowd estimate honestly", () => {
    expect(narrateItinerary({
      dow: 2,
      request: { date: "2026-05-19", startMin: 540 },
      summary: { finishMin: 720 },
      stops: [
        { name: "The Met", startMin: 570, visitMin: 90, leg: null, crowd: { band: "quiet" } },
        { name: "Central Park", startMin: 690, visitMin: 30, leg: { minutes: 20, mode: "walk" }, crowd: null },
      ],
      returnLeg: null,
    })).toBe("Your New York day is Tuesday, May 19. It runs from 9am to about 12pm with 2 stops. First, The Met at 9:30am for about 1h 30m. Nearby crowd levels are estimated as Quiet. Then, Central Park at 11:30am for about 30 min. Travel to the next stop takes about 20 min on foot. Travel times are estimates, and crowd levels describe the surrounding area, not venue queues.");
  });
});
