import { readBody, respond, tripId } from "../http";
import { CandidateBody } from "../schema";
import { resolveMember } from "../member";
import { getTripStore } from "../store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/candidates">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId: claimed, stop, note, creditTo } = await readBody(request, CandidateBody);
    const { memberId = claimed } = await resolveMember(request, claimed);
    return getTripStore().addCandidate(id, memberId, stop, { note, creditTo });
  });
}
