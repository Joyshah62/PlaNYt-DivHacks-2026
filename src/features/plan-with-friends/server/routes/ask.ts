import { readBody, respond, tripId } from "../http";
import { actingMember } from "../member";
import { AskBody } from "../schema";
import { TripError } from "../service";
import { getTripStore } from "../store";
import { askRoom } from "../suggest";

/** POST /api/trips/[id]/ask - Ask Roam with the room as context; returns places to add. */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/ask">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, text } = await readBody(request, AskBody);
    const memberId = await actingMember(request, claimed);
    const trip = await getTripStore().get(id);
    if (!(memberId in trip.members)) throw new TripError(403, "Join the trip first.");
    return askRoom(trip, text);
  });
}
