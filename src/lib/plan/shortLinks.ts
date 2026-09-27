import { createHash } from "node:crypto";
import { getDb, hasMongo } from "@/lib/mongo";

/**
 * Short links for a plan code (`/p/<id>` instead of `/plan?plan=<long code>`), for texts.
 * The id comes from the code itself, so the same day always gets the same link.
 */
export const shortId = (code: string) => createHash("sha256").update(code).digest("base64url").slice(0, 8);

const COLLECTION = "short_links";
/** Without MongoDB (local development) links last as long as the server. */
const memory = new Map<string, string>();

export async function saveShortLink(code: string): Promise<string> {
  const id = shortId(code);
  if (!hasMongo()) memory.set(id, code);
  else await (await getDb()).collection<{ _id: string; code: string; at: Date }>(COLLECTION).updateOne({ _id: id }, { $setOnInsert: { code, at: new Date() } }, { upsert: true });
  return id;
}

export async function readShortLink(id: string): Promise<string | null> {
  if (!/^[\w-]{8}$/.test(id)) return null;
  if (!hasMongo()) return memory.get(id) ?? null;
  const doc = await (await getDb()).collection<{ _id: string; code: string }>(COLLECTION).findOne({ _id: id });
  return doc?.code ?? null;
}
