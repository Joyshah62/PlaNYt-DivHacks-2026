import type { z } from "zod";
import { TRIP_ID } from "./schema";
import { TripError } from "./service";

export async function readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new TripError(400, "Expected a JSON body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new TripError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
  return parsed.data;
}

export function tripId(raw: string): string {
  if (!TRIP_ID.test(raw)) throw new TripError(404, "This trip has expired or the link is wrong.");
  return raw;
}

export async function respond(work: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await work());
  } catch (error) {
    if (error instanceof TripError) return Response.json({ error: error.message }, { status: error.status });
    console.error("[trips]", error);
    return Response.json({ error: "Trips are unavailable right now." }, { status: 503 });
  }
}
