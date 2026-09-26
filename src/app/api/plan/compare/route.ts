import { z } from "zod";
import { inNycArea } from "@/lib/osm/geo";
import { compareOptions } from "@/lib/plan/compare";
import { PlanRequestSchema, StopSchema } from "@/lib/plan/schema";

const CompareSchema = z.object({
  request: PlanRequestSchema,
  /** The stop key the options would replace; null to add them. */
  slot: z.string().max(80).nullable(),
  /** null = leave the slot empty. */
  options: z.array(StopSchema.nullable()).min(1).max(5),
});

/** POST /api/plan/compare - what each option for one slot does to the whole day. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const parsed = CompareSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid comparison." }, { status: 400 });
  const { request: plan, slot, options } = parsed.data;
  if (!options.every((o) => !o || inNycArea(o))) return Response.json({ error: "Every place must be in New York City." }, { status: 400 });
  try {
    return Response.json({ outcomes: await compareOptions(plan, slot, options) });
  } catch (error) {
    console.error("[compare]", error);
    return Response.json({ error: "Couldn't compare those options right now." }, { status: 500 });
  }
}
