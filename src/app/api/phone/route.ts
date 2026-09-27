import { z } from "zod";
import { decodePlan } from "@/lib/plan/share";

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
  const bridge = process.env.PHONE_BRIDGE_URL;
  const token = process.env.PHONE_BRIDGE_TOKEN;
  if (!bridge || !token) return Response.json({ error: "Texting isn't set up on this server." }, { status: 503 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a phone number or Apple ID email." }, { status: 400 });
  const request = decodePlan(parsed.data.plan);
  if (!request?.stops.length) return Response.json({ error: "This plan couldn't be read. Try planning it again." }, { status: 400 });

  const key = parsed.data.handle.replace(/\D/g, "") || parsed.data.handle.toLowerCase();
  const now = Date.now();
  const sent = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (sent.length >= LIMIT) return Response.json({ error: "That number has had a few plans already. Try again in an hour." }, { status: 429 });

  let res: Response;
  try {
    res = await fetch(new URL("/send", bridge), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ handle: parsed.data.handle, request }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return Response.json({ error: "The texting service isn't running right now." }, { status: 503 });
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return Response.json({ error: body.error ?? "Couldn't send the text." }, { status: res.status === 400 || res.status === 403 ? res.status : 502 });
  recent.set(key, [...sent, now]);
  return Response.json({ ok: true });
}
