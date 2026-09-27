import { readBody, respond, tripId } from "../http";
import { actingMember } from "../member";
import { FreeBody } from "../schema";
import { getTripStore } from "../store";

/** POST /api/trips/[id]/free - when you can make it; the day fits the time the group shares. */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/free">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, free } = await readBody(request, FreeBody);
    const memberId = await actingMember(request, claimed);
    return getTripStore().setFree(id, memberId, free);
  });
}
