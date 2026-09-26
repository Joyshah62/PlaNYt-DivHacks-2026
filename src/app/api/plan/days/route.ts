import { z } from "zod";
import { compareDays } from "@/lib/plan/compare";
import { PlanRequestSchema } from "@/lib/plan/schema";

const DaysSchema = z.object({
  request: PlanRequestSchema,
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().min(1).max(21),
});

/** POST /api/plan/days - the same day planned on each of the coming days, to pick when to go. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const parsed = DaysSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  try {
    const { request: plan, from, count } = parsed.data;
    return Response.json({ days: await compareDays(plan, from, count) });
  } catch (error) {
    console.error("[days]", error);
    return Response.json({ error: "Couldn't compare days right now." }, { status: 500 });
  }
}
