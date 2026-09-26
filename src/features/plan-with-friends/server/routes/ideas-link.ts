import { readBody, respond, tripId } from "../http";
import { resolveMember } from "../member";
import { IdeaLinkBody } from "../schema";
import { getTripStore } from "../store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/ideas/link">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, ideaId, placeKey } = await readBody(request, IdeaLinkBody);
    const { memberId = claimed } = await resolveMember(request, claimed);
    return getTripStore().linkIdea(id, memberId, ideaId, placeKey);
  });
}
