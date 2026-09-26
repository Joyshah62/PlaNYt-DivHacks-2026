import { readBody, respond, tripId } from "../http";
import { VoteBody } from "../schema";
import { getTripStore } from "../store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/vote">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId, stopKey, on } = await readBody(request, VoteBody);
    return getTripStore().vote(id, memberId, stopKey, on);
  });
}
