import { readBody, respond, tripId } from "../http";
import { resolveMember } from "../member";
import { StartBody } from "../schema";
import { getTripStore } from "../store";

/** POST /api/trips/[id]/start - where you're coming from (rounded; others only see the area). */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/start">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, point } = await readBody(request, StartBody);
    const { memberId = claimed } = await resolveMember(request, claimed);
    return getTripStore().setStart(id, memberId, point);
  });
}
