import { createHash } from "node:crypto";
import { respond, tripId } from "../http";
import { getTripStore } from "../store";

/**
 * GET /api/trips/[id] - the trip as everyone sees it. Rooms poll this every few seconds, so it
 * carries an ETag: when nothing changed the answer is an empty 304, not the whole trip again.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/trips/[id]">) {
  const res = await respond(async () => getTripStore().get(tripId((await ctx.params).id)));
  if (!res.ok) return res;
  const body = await res.text();
  const etag = `W/"${createHash("sha1").update(body).digest("base64url").slice(0, 16)}"`;
  const headers = { etag, "cache-control": "no-cache" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { headers: { ...headers, "content-type": "application/json" } });
}
