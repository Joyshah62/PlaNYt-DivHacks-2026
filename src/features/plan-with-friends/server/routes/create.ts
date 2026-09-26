import { PlanRequestSchema } from "../../bridge/index";
import { decodePlan } from "../../bridge/index";
import { WEEKDAYS, weekdayOf } from "../../bridge/index";
import { readBody, respond } from "../http";
import { CreateTripBody } from "../schema";
import { TripError } from "../service";
import { getTripStore } from "../store";

/** POST /api/trips - start a group trip from a plan link's code. */
export async function POST(request: Request) {
  return respond(async () => {
    const { name, code } = await readBody(request, CreateTripBody);
    const parsed = PlanRequestSchema.safeParse(decodePlan(code));
    if (!parsed.success) throw new TripError(400, "That plan link doesn't work.");
    const r = parsed.data;
    const settings = {
      date: r.date,
      startMin: r.startMin,
      endMin: r.endMin,
      mode: r.mode,
      crowd: r.crowd,
      origin: r.origin,
      returnToOrigin: r.returnToOrigin,
      profile: r.profile,
      meals: r.meals,
    };
    return getTripStore().create({ title: `${WEEKDAYS[weekdayOf(r.date)]} in NYC`, settings, stops: r.stops, name });
  });
}
