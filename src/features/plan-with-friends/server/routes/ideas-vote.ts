import { readBody, respond, tripId } from "../http";
import { resolveMember } from "../member";
import { IdeaVoteBody } from "../schema";
import { getTripStore } from "../store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/ideas/vote">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, ideaId, on } = await readBody(request, IdeaVoteBody);
    const { memberId = claimed } = await resolveMember(request, claimed);
    return getTripStore().voteIdea(id, memberId, ideaId, on);
  });
}
