import { readBody, respond, tripId } from "../http";
import { CandidateBody } from "../schema";
import { getTripStore } from "../store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/candidates">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId, stop } = await readBody(request, CandidateBody);
    return getTripStore().addCandidate(id, memberId, stop);
  });
}
