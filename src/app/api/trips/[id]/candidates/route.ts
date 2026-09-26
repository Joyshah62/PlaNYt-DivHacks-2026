import { readBody, respond, tripId } from "@/lib/trip/http";
import { CandidateBody } from "@/lib/trip/schema";
import { getTripStore } from "@/lib/trip/store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/candidates">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { memberId, stop } = await readBody(request, CandidateBody);
    return getTripStore().addCandidate(id, memberId, stop);
  });
}
