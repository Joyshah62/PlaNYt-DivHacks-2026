import { readBody, respond, tripId } from "../http";
import { resolveMember } from "../member";
import { ItineraryBody } from "../schema";
import { getTripStore } from "../store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/itinerary">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, order } = await readBody(request, ItineraryBody);
    const { memberId = claimed } = await resolveMember(request, claimed);
    return getTripStore().setItinerary(id, memberId, order);
  });
}
