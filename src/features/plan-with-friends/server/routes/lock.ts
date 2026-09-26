import { readBody, respond, tripId } from "../http";
import { LockBody } from "../schema";
import { getTripStore } from "../store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/lock">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { organizerKey } = await readBody(request, LockBody);
    return getTripStore().lock(id, organizerKey);
  });
}
