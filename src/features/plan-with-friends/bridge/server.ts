import { readFile } from "node:fs/promises";
import path from "node:path";

export { getDb, hasMongo } from "@/lib/mongo";

/** The ~30k NYC places bundled for Discover (built by scripts/build-poi-data.mjs). */
export async function readPoiRows(): Promise<unknown[]> {
  const raw = await readFile(path.join(process.cwd(), "src/lib/discover/poi-data.json"), "utf8");
  return (JSON.parse(raw) as { places: unknown[] }).places;
}
