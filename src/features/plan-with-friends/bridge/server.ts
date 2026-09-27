import { readFile } from "node:fs/promises";
import path from "node:path";

export { getDb, hasMongo } from "@/lib/mongo";

/** The ~30k NYC places bundled for Discover (built by scripts/build-poi-data.mjs). */
export async function readPoiRows(): Promise<unknown[]> {
  const raw = await readFile(path.join(process.cwd(), "src/lib/discover/poi-data.json"), "utf8");
  return (JSON.parse(raw) as { places: unknown[] }).places;
}

export { searchLocal } from "@/lib/discover/sources";
export { fallbackIntent } from "@/lib/discover/intent";
export type { Intent, Candidate as DiscoverCandidate } from "@/lib/discover/types";

/** Same model as the landing page's assistant (/api/assistant); keep them in step. */
export const GEMINI_MODEL = "gemini-3.5-flash-lite";
export const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
export { resolveDestination } from "@/lib/osm/nominatim";
