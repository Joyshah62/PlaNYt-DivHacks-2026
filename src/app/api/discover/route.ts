import { discover } from "@/lib/discover/service";

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Expected a JSON body." }, { status: 400 }); }
  return discover(body);
}
