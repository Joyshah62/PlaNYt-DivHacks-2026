import { readShortLink } from "@/lib/plan/shortLinks";

/** GET /p/<id> - a short plan link from a text; opens the day in the planner. */
export async function GET(_request: Request, ctx: RouteContext<"/p/[id]">) {
  let code: string | null;
  try {
    code = await readShortLink((await ctx.params).id);
  } catch (error) {
    // The link is fine, the store isn't: say so rather than open an empty planner.
    console.error("[p] couldn't read a short link:", error instanceof Error ? error.message : error);
    return new Response("We couldn't open this plan right now. Try the link again in a minute.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "30" } });
  }
  // A relative Location, so it works behind the host's proxy.
  return new Response(null, { status: 307, headers: { Location: code ? `/plan?plan=${code}` : "/plan" } });
}
