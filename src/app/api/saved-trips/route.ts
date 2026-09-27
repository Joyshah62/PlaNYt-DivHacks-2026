import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decodePlan } from "@/lib/plan/share";

const Entry = z.object({ id: z.string().min(1).max(80), title: z.string().min(1).max(180), savedAt: z.string().datetime(), code: z.string().min(1).max(8000) });
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), plan: Entry }),
  z.object({ action: z.literal("remove"), id: z.string().min(1).max(80) }),
  z.object({ action: z.literal("import"), plans: z.array(Entry).max(30) }),
]);
type SavedTrip = z.infer<typeof Entry> & { owner: string; updatedAt: Date };
const trips = () => db.collection<SavedTrip>("savedTrips");

async function ownerFor(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  return session ? `user:${session.user.id}` : null;
}

export async function GET(req: Request) {
  const owner = await ownerFor(req);
  if (!owner) return Response.json({ error: "Sign in to sync saved trips." }, { status: 401 });
  const saved = await trips().find({ owner }, { projection: { _id: 0, owner: 0, updatedAt: 0 } }).sort({ savedAt: -1 }).limit(30).toArray();
  return Response.json({ plans: saved });
}

export async function POST(req: Request) {
  const owner = await ownerFor(req);
  if (!owner) return Response.json({ error: "Sign in to sync saved trips." }, { status: 401 });
  let raw: unknown;
  try { raw = await req.json(); } catch { return Response.json({ error: "Expected a JSON body." }, { status: 400 }); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "That saved trip isn't valid." }, { status: 400 });
  const plans = parsed.data.action === "save" ? [parsed.data.plan] : parsed.data.action === "import" ? parsed.data.plans : [];
  if (plans.some((p) => !decodePlan(p.code)?.stops.length)) return Response.json({ error: "A saved trip could not be read." }, { status: 400 });
  if (parsed.data.action === "remove") {
    await trips().deleteOne({ owner, id: parsed.data.id });
    return Response.json({ ok: true });
  }
  await Promise.all(plans.map((plan) => trips().updateOne(
    { owner, id: plan.id },
    { $set: { ...plan, owner, updatedAt: new Date() } },
    { upsert: true },
  )));
  return Response.json({ ok: true });
}
