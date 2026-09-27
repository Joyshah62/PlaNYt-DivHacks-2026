import { decodePlan } from "@/lib/plan/share";
import { saveShortLink } from "@/lib/plan/shortLinks";

/** POST /api/plan/short - a short id for a plan code, opened at /p/<id>. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code || code.length > 8000 || !decodePlan(code)) return Response.json({ error: "That isn't a plan." }, { status: 400 });
  try {
    return Response.json({ id: await saveShortLink(code) });
  } catch (error) {
    console.error("[plan/short]", error instanceof Error ? error.message : error);
    return Response.json({ error: "Couldn't shorten the link right now." }, { status: 503 });
  }
}
