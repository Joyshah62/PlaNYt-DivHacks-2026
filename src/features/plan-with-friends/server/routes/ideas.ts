import { readBody, respond, tripId } from "../http";
import { actingMember } from "../member";
import { IdeaBody } from "../schema";
import { getTripStore } from "../store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/ideas">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, text } = await readBody(request, IdeaBody);
    const memberId = await actingMember(request, claimed);
    return getTripStore().addIdea(id, memberId, text);
  });
}
