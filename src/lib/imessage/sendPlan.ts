import type { PlanRequest } from "@/lib/plan/types";

/** Why a plan couldn't be texted, written for people; `status` is the HTTP status to answer with. */
export class SendPlanError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Texting works on this server: the iMessage bot's bridge is configured. */
export const canTextPlans = () => !!process.env.PHONE_BRIDGE_URL && !!process.env.PHONE_BRIDGE_TOKEN;

/**
 * Texts `request` to a phone number (or Apple ID email) through the iMessage
 * bot (scripts/imessage.mts), which then texts before each leg on the day.
 * `intro` replaces the bot's usual hello, e.g. "Khyati approved the plan".
 */
export async function sendPlanText(handle: string, request: PlanRequest, intro?: string): Promise<void> {
  const bridge = process.env.PHONE_BRIDGE_URL;
  const token = process.env.PHONE_BRIDGE_TOKEN;
  if (!bridge || !token) throw new SendPlanError("Texting isn't set up on this server.", 503);
  let res: Response;
  try {
    res = await fetch(new URL("/send", bridge), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ handle, request, ...(intro && { intro }) }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new SendPlanError("The texting service isn't running right now.", 503);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new SendPlanError(body.error ?? "Couldn't send the text.", res.status === 400 || res.status === 403 ? res.status : 502);
}
