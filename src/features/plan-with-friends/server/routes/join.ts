import { readBody, respond, tripId } from "../http";
import { JoinBody } from "../schema";
import { getTripStore } from "../store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/join">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { name, avatar } = await readBody(request, JoinBody);
    return getTripStore().join(id, name, avatar);
  });
}
