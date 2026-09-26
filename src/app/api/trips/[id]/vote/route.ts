import { readBody, respond, tripId } from "@/lib/trip/http";
import { VoteBody } from "@/lib/trip/schema";
import { getTripStore } from "@/lib/trip/store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/vote">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId, stopKey, on } = await readBody(request, VoteBody);
    return getTripStore().vote(id, memberId, stopKey, on);
  });
}
