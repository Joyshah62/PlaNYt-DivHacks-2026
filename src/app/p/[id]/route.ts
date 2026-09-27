import { readShortLink } from "@/lib/plan/shortLinks";

/** GET /p/<id> - a short plan link from a text; opens the day in the planner. */
export async function GET(_request: Request, ctx: RouteContext<"/p/[id]">) {
  const code = await readShortLink((await ctx.params).id).catch(() => null);
  // A relative Location, so it works behind the host's proxy.
  return new Response(null, { status: 307, headers: { Location: code ? `/plan?plan=${code}` : "/plan" } });
}
