import { DEFAULT_PROFILE, decodePlan, nycToday, PlanRequestSchema, WEEKDAYS, weekdayOf, type StopInput } from "../../bridge/index";
import type { TripSettings } from "../../core/types";
import { readBody, respond } from "../http";
import { CreateTripBody } from "../schema";
import { TripError } from "../service";
import { resolveMember } from "../member";
import { getTripStore } from "../store";

function blankDay(date: string): TripSettings {
  return {
    date,
    startMin: 10 * 60,
    endMin: 21 * 60,
    mode: "transit",
    crowd: "avoid",
    origin: null,
    returnToOrigin: false,
    profile: DEFAULT_PROFILE,
    meals: { lunch: false, dinner: false },
  };
}

/** POST /api/trips - start a trip room, seeded from a plan link or empty for a date. */
export async function POST(request: Request) {
  return respond(async () => {
    const { name, avatar, code, date } = await readBody(request, CreateTripBody);
    let settings: TripSettings;
    let stops: StopInput[] = [];
    if (code) {
      const parsed = PlanRequestSchema.safeParse(decodePlan(code));
      if (!parsed.success) throw new TripError(400, "That plan link doesn't work.");
      const r = parsed.data;
      stops = r.stops;
      settings = { date: r.date, startMin: r.startMin, endMin: r.endMin, mode: r.mode, crowd: r.crowd, origin: r.origin, returnToOrigin: r.returnToOrigin, profile: r.profile, meals: r.meals };
    } else {
      if (!date || date < nycToday()) throw new TripError(400, "Pick today or a later date.");
      settings = blankDay(date);
    }
    const { memberId, user } = await resolveMember(request, undefined);
    return getTripStore().create({ title: `${WEEKDAYS[weekdayOf(settings.date)]} in NYC`, settings, stops, name: user?.name ?? name, avatar, memberId });
  });
}
