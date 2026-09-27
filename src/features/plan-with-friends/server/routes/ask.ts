import { clock } from "../../bridge/index";
import { readBody, respond, tripId } from "../http";
import { actingMember } from "../member";
import { MAX_CANDIDATES } from "../../core/types";
import { AskBody } from "../schema";
import { TripError } from "../service";
import { getTripStore } from "../store";
import { askRoom } from "../suggest";

/**
 * POST /api/trips/[id]/ask - Ask Roam AI with the room as context. Anyone gets
 * places to add; the host's request plans the day: the best match for each
 * thing asked goes in, in the order asked, and the other matches stay as swaps.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/ask">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, text } = await readBody(request, AskBody);
    const memberId = await actingMember(request, claimed);
    const store = getTripStore();
    const trip = await store.get(id);
    if (!(memberId in trip.members)) throw new TripError(403, "Join the trip first.");
    const answer = await askRoom(trip, text);
    if (memberId !== trip.hostId || trip.lockedCode || !answer.picks.length) return { ...answer, planned: false };

    // Check room for every new place first: failing halfway would leave places added but no day planned.
    const fresh = answer.picks.filter((s) => !trip.candidates.some((c) => c.stop.key === s.key)).length;
    if (trip.candidates.length + fresh > MAX_CANDIDATES) throw new TripError(400, "This trip has enough ideas to plan from. Remove a few, or vote on the ones already here.");
    for (const stop of answer.picks) await store.addCandidate(id, memberId, stop);
    const planned = await store.setItinerary(id, memberId, answer.picks.map((s) => s.key));
    const day = answer.picks.map((s) => `${s.name}${s.fixedStartMin != null ? ` at ${clock(s.fixedStartMin)}` : ""}`).join(" → ");
    const missed = answer.missed.length ? ` I couldn't find ${answer.missed.join(" or ")} nearby, so that's not in yet.` : "";
    const picked = new Set(answer.picks.map((s) => s.key));
    return {
      ...answer,
      reply: `Planned the day: ${day}.${missed} Everyone can still vote, swap in one of these, or drag to change it.`,
      items: answer.items.filter((i) => !picked.has(i.key)),
      planned: true,
      trip: planned,
    };
  });
}
