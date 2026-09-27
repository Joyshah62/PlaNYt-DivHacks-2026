import { readBody, respond, tripId } from "../http";
import { actingMember } from "../member";
import { IdeaSuggestBody } from "../schema";
import { TripError } from "../service";
import { getTripStore } from "../store";
import { ideaSuggestions } from "../suggest";

/** POST /api/trips/[id]/ideas/suggest - places that match a chat note, for "Turn into a place". */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/ideas/suggest">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, ideaId } = await readBody(request, IdeaSuggestBody);
    const memberId = await actingMember(request, claimed);
    const trip = await getTripStore().get(id);
    if (!(memberId in trip.members)) throw new TripError(403, "Join the trip first.");
    const idea = trip.ideas.find((i) => i.id === ideaId);
    if (!idea) throw new TripError(404, "That idea isn't here anymore.");
    return { ...(await ideaSuggestions(trip, idea)), authorId: idea.memberId };
  });
}
