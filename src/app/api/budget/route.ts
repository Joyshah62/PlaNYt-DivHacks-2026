import { buildPlan } from "@/lib/plan/build";
import { PlanRequestSchema } from "@/lib/plan/schema";
import { budgetFor } from "@/lib/web/prices";

/**
 * POST /api/budget { request } - what the day costs one person: tickets and
 * typical food spend read from the web, estimated meals, subway fares.
 */
export async function POST(req: Request) {
  const parsed = PlanRequestSchema.safeParse((await req.json().catch(() => null))?.request);
  if (!parsed.success) return Response.json({ error: "Please refresh your trip and try again." }, { status: 400 });
  try {
    return Response.json(await budgetFor(await buildPlan(parsed.data)));
  } catch (error) {
    console.error("[budget]", error instanceof Error ? error.message : error);
    return Response.json({ error: "Couldn't work out the budget right now." }, { status: 500 });
  }
}
