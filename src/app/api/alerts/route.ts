import { z } from "zod";
import { auth } from "@/lib/auth";
import { liveAlerts } from "@/lib/plan/liveAlerts";

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  places: z.array(z.string().trim().min(1).max(120)).min(1).max(10),
});

/**
 * POST /api/alerts { date, places } - live heads-ups for a planned day (events, closures, crowds),
 * from the web. Signed-in travelers only: each new day costs web searches.
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await auth.api.getSession({ headers: request.headers });
  } catch (error) {
    // The session store failing isn't the same as being signed out.
    console.error("[alerts] couldn't check the session:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Live alerts aren't available right now." }, { status: 503 });
  }
  if (!session) return Response.json({ error: "Sign in to see live alerts." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send a date and the day's places." }, { status: 400 });
  return Response.json({ alerts: await liveAlerts(parsed.data.date, parsed.data.places) });
}
