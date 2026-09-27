import { decodePlan } from "@/lib/plan/share";
import { saveShortLink } from "@/lib/plan/shortLinks";

/** POST /api/plan/short - a short id for a plan code, opened at /p/<id>. Codes the planner would cut off (over 4000) are refused. */
export async function POST(request: Request) {
  // Only the iMessage bot makes these; when the bridge token is set, it must come with it.
  const token = process.env.PHONE_BRIDGE_TOKEN;
  if (token && request.headers.get("authorization") !== `Bearer ${token}`) return Response.json({ error: "Not allowed." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code || code.length > 4000 || !decodePlan(code)) return Response.json({ error: "That isn't a plan." }, { status: 400 });
  try {
    return Response.json({ id: await saveShortLink(code) });
  } catch (error) {
    console.error("[plan/short]", error instanceof Error ? error.message : error);
    return Response.json({ error: "Couldn't shorten the link right now." }, { status: 503 });
  }
}
