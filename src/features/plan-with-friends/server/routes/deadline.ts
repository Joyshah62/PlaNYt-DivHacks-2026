import { readBody, respond, tripId } from "../http";
import { DeadlineBody } from "../schema";
import { actingMember } from "../member";
import { getTripStore } from "../store";

/** POST /api/trips/[id]/deadline - after this time a majority is enough to lock. */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/deadline">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, at } = await readBody(request, DeadlineBody);
    const memberId = await actingMember(request, claimed);
    return getTripStore().setDeadline(id, memberId, at);
  });
}
