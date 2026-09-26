import { readBody, respond, tripId } from "../http";
import { ConfirmBody } from "../schema";
import { getTripStore } from "../store";

/** POST /api/trips/[id]/confirm - "I'm in" (or out) on the day as it is right now. */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/confirm">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId, on } = await readBody(request, ConfirmBody);
    return getTripStore().confirm(id, memberId, on);
  });
}
