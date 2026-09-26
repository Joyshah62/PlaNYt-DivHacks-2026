import { readBody, respond, tripId } from "@/lib/trip/http";
import { JoinBody } from "@/lib/trip/schema";
import { getTripStore } from "@/lib/trip/store";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/join">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const { name } = await readBody(request, JoinBody);
    return getTripStore().join(id, name);
  });
}
