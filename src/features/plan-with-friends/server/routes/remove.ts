import { readBody, respond, tripId } from "../http";
import { resolveMember } from "../member";
import { RemoveBody } from "../schema";
import { getTripStore } from "../store";

/** POST /api/trips/[id]/remove - take back a place you suggested. */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/remove">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, stopKey } = await readBody(request, RemoveBody);
    const { memberId = claimed } = await resolveMember(request, claimed);
    return getTripStore().removeCandidate(id, memberId, stopKey);
  });
}
