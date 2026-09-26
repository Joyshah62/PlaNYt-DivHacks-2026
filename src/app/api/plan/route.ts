import { buildPlan } from "@/lib/plan/build";
import { PlanRequestSchema } from "@/lib/plan/schema";
import { nycNowMin, nycToday } from "@/lib/plan/time";

/** POST /api/plan - order a day's stops around travel time, opening hours and crowds. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const parsed = PlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid plan." }, { status: 400 });
  }
  // A day planned for today can't start in the past: begin from the next quarter hour.
  const day = parsed.data;
  if (day.date === nycToday()) {
    const soon = Math.ceil((nycNowMin() + 5) / 15) * 15;
    if (day.startMin < soon && soon < day.endMin - 30) day.startMin = soon;
  }
  try {
    return Response.json(await buildPlan(day));
  } catch (error) {
    console.error("[plan]", error);
    return Response.json({ error: "Couldn't build the plan right now." }, { status: 500 });
  }
}
