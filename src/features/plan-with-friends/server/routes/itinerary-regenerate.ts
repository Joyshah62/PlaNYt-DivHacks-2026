import { readBody, respond, tripId } from "../http";
import { resolveMember } from "../member";
import { RegenerateBody } from "../schema";
import { getTripStore } from "../store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/itinerary/regenerate">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed } = await readBody(request, RegenerateBody);
    const { memberId = claimed } = await resolveMember(request, claimed);
    return getTripStore().regenerate(id, memberId);
  });
}
