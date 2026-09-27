import { readBody, respond, tripId } from "../http";
import { VoteBody } from "../schema";
import { actingMember } from "../member";
import { getTripStore } from "../store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/vote">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, stopKey, on } = await readBody(request, VoteBody);
    const memberId = await actingMember(request, claimed);
    return getTripStore().vote(id, memberId, stopKey, on);
  });
}
