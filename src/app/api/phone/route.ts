import { z } from "zod";
import { decodePlan } from "@/lib/plan/share";
import { canTextPlans, SendPlanError, sendPlanText } from "@/lib/imessage/sendPlan";

const Body = z.object({
  handle: z.string().trim().min(3).max(80),
  /** The plan's share code, as in /plan?plan=... */
  plan: z.string().min(4).max(4000),
});

/** A few texts per number per hour, so the button can't be used to spam someone. */
const LIMIT = 3;
const WINDOW_MS = 60 * 60_000;
const recent = new Map<string, number[]>();

/**
 * POST /api/phone { handle, plan } - "Text it to me": the iMessage bot (the
 * divhacks sidecar) sends the plan to this number and texts before each leg
 * on the day.
 */
export async function POST(req: Request) {
  if (!canTextPlans()) return Response.json({ error: "Texting isn't set up on this server." }, { status: 503 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a phone number or Apple ID email." }, { status: 400 });
  const request = decodePlan(parsed.data.plan);
  if (!request?.stops.length) return Response.json({ error: "This plan couldn't be read. Try planning it again." }, { status: 400 });

  const key = parsed.data.handle.replace(/\D/g, "") || parsed.data.handle.toLowerCase();
  const now = Date.now();
  const sent = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (sent.length >= LIMIT) return Response.json({ error: "That number has had a few plans already. Try again in an hour." }, { status: 429 });

  try {
    await sendPlanText(parsed.data.handle, request);
  } catch (error) {
    if (error instanceof SendPlanError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
  recent.set(key, [...sent, now]);
  return Response.json({ ok: true });
}
