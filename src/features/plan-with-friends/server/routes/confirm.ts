import { readBody, respond, tripId } from "../http";
import { ConfirmBody } from "../schema";
import { resolveMember } from "../member";
import { getTripStore } from "../store";

/** POST /api/trips/[id]/confirm - "I'm in" (or out) on the day as it is right now. */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/confirm">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, on } = await readBody(request, ConfirmBody);
    const { memberId = claimed } = await resolveMember(request, claimed);
    return getTripStore().confirm(id, memberId, on);
  });
}
