import { CROWD_LABEL } from "./display";
import { clock, duration, WEEKDAYS } from "./time";
import type { DayPlan, Leg, PlanSummary, PlanRequest, PlannedStop } from "./types";

type Stop = Pick<PlannedStop, "name" | "startMin" | "visitMin"> & {
  leg: Pick<Leg, "minutes" | "mode"> | null;
  crowd: Pick<NonNullable<PlannedStop["crowd"]>, "band"> | null;
};

export function narrateItinerary(plan: Pick<DayPlan, "dow"> & {
  request: Pick<PlanRequest, "date" | "startMin">;
  summary: Pick<PlanSummary, "finishMin">;
  stops: Stop[];
  returnLeg: Pick<Leg, "minutes"> | null;
}) {
  const { request, summary, stops } = plan;
  const date = new Date(`${request.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  const details = stops.map((stop, i) => {
    const visit = `${i === 0 ? "First" : "Then"}, ${stop.name} at ${clock(stop.startMin)} for about ${duration(stop.visitMin)}.`;
    const travel = stop.leg ? ` Travel to the next stop takes about ${duration(stop.leg.minutes)} ${stop.leg.mode === "walk" ? "on foot" : `by ${stop.leg.mode === "subway" ? "subway" : stop.leg.mode}`}.` : "";
    const crowd = stop.crowd ? ` Nearby crowd levels are estimated as ${CROWD_LABEL[stop.crowd.band]}.` : "";
    return visit + travel + crowd;
  });
  const opening = `Your New York day is ${WEEKDAYS[plan.dow]}, ${date}. It runs from ${clock(request.startMin)} to about ${clock(summary.finishMin)} with ${stops.length} ${stops.length === 1 ? "stop" : "stops"}.`;
  const ending = plan.returnLeg ? ` The estimated trip back takes ${duration(plan.returnLeg.minutes)}.` : "";
  return `${opening} ${details.join(" ")}${ending} Travel times are estimates, and crowd levels describe the surrounding area, not venue queues.`;
}
