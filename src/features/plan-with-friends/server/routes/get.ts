import { respond, tripId } from "../http";
import { getTripStore } from "../store";

/** GET /api/trips/[id] - the trip as everyone sees it. */
export async function GET(_request: Request, ctx: RouteContext<"/api/trips/[id]">) {
  return respond(async () => getTripStore().get(tripId((await ctx.params).id)));
}
