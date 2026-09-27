import { readBody, respond, tripId } from "../http";
import { actingMember } from "../member";
import { ApproveBody } from "../schema";
import { getTripStore } from "../store";

/** POST /api/trips/[id]/approve - the host makes the day final; everyone is texted the plan. */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/approve">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed } = await readBody(request, ApproveBody);
    const memberId = await actingMember(request, claimed);
    return getTripStore().approve(id, memberId);
  });
}
