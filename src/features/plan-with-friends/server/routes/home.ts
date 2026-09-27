import { inNycArea } from "../../bridge/index";
import { homePlanFor } from "../home";
import { respond, tripId } from "../http";
import { TripError } from "../service";
import { getTripStore } from "../store";

/** GET /api/trips/[id]/home?lat=&lon=&at= - everyone's ways home from the day's last stop. */
export async function GET(request: Request, ctx: RouteContext<"/api/trips/[id]/home">) {
  return respond(async () => {
    const id = tripId((await ctx.params).id);
    const params = new URL(request.url).searchParams;
    const from = { lat: Number(params.get("lat")), lon: Number(params.get("lon")) };
    const at = Number(params.get("at"));
    if (!Number.isFinite(from.lat) || !Number.isFinite(from.lon) || !inNycArea(from) || !Number.isFinite(at)) throw new TripError(400, "Pick a last stop in New York City.");
    const trip = await getTripStore().get(id);
    const home = Object.entries(trip.members).flatMap(([memberId, m]) => (m.start ? [{ memberId, ...homePlanFor(from, m.start, at) }] : []));
    return { home };
  });
}
